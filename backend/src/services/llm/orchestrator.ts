/**
 * LLM 호출 오케스트레이터 — 라우트에서 호출하는 고수준 함수 모음.
 *
 * 각 함수는:
 * 1) DB에서 필요한 컨텍스트 조회
 * 2) 프롬프트 빌드
 * 3) Gemini / Claude 호출
 * 4) 결과 검증 + DB 기록
 * 5) Video.status 적절히 갱신
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { LLMProvider, ScenarioAngle, TrimField, VideoStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
// import { callClaude } from './claude.js';  // 임시 비활성화 — Anthropic 잔액 부족
import { callGemini, parseJsonResponse } from './gemini.js';
import {
  buildScenarioPrompt,
  buildSectionPrompt,
  buildTrimPrompt,
  buildVideoFromImagePrompt,
  SCENARIO_RESPONSE_SCHEMA,
  SCENARIO_SYSTEM,
  SECTION_RESPONSE_SCHEMA,
  SECTION_SYSTEM,
  TRIM_SYSTEM,
  VIDEO_FROM_IMAGE_SYSTEM,
} from './prompts.js';

// ─── 1. 시나리오 N개 생성 + 각 시나리오의 hook을 Claude로 생성 ────

export async function generateScenariosForVideo(videoId: string, count: number = 3) {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { project: true },
  });
  const p = video.project;

  // 1) Gemini Pro로 시나리오 N개 생성
  const userPrompt = buildScenarioPrompt({
    appName: p.appName,
    targetUser: p.targetUser,
    valueProposition: p.valueProposition,
    tone: p.tone,
    storeUrl: p.storeUrl,
    description: p.description,
    durationSeconds: video.durationSeconds,
    count,
  });

  const { text, modelUsed } = await callGemini({
    model: 'pro',
    systemInstruction: SCENARIO_SYSTEM,
    userPrompt,
    responseSchema: SCENARIO_RESPONSE_SCHEMA,
    temperature: 0.9,
  });

  const parsed = parseJsonResponse<{
    scenarios: Array<{ angle: ScenarioAngle; content: string; hook_line: string }>;
  }>(text);

  if (!parsed.scenarios?.length) {
    throw new Error('Gemini returned no scenarios');
  }

  const geminiProvider: LLMProvider = modelUsed.includes('flash') ? 'GEMINI_FLASH' : 'GEMINI_PRO';

  // hook_line은 Gemini가 시나리오와 같이 반환 (Claude 임시 비활성화)
  const created = await prisma.$transaction(async (tx) => {
    await tx.scenario.deleteMany({ where: { videoId } });
    const rows = await Promise.all(
      parsed.scenarios.map((s) =>
        tx.scenario.create({
          data: {
            videoId,
            angle: s.angle,
            content: s.content,
            hookLine: (s.hook_line ?? '').replace(/^["'`]|["'`]$/g, '').trim(),
            generatedBy: geminiProvider,
          },
        })
      )
    );
    await tx.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.SCENARIOS_READY, selectedScenarioId: null },
    });
    return rows;
  });

  return created;
}

// ─── 2. 시나리오 선택 → 섹션 분할 ─────────────────────────────────────

export async function generateSectionsForVideo(videoId: string, scenarioId: string) {
  const [video, scenario] = await Promise.all([
    prisma.video.findUniqueOrThrow({
      where: { id: videoId },
      include: { project: true },
    }),
    prisma.scenario.findUniqueOrThrow({ where: { id: scenarioId } }),
  ]);

  if (scenario.videoId !== videoId) {
    throw new Error('Scenario does not belong to this video');
  }

  const p = video.project;
  const sectionCount = recommendSectionCount(video.durationSeconds);

  const userPrompt = buildSectionPrompt({
    appName: p.appName,
    targetUser: p.targetUser,
    valueProposition: p.valueProposition,
    tone: p.tone,
    angle: scenario.angle,
    hookLine: scenario.hookLine,
    content: scenario.content,
    totalDurationSeconds: video.durationSeconds,
    sectionCount,
  });

  const { text } = await callGemini({
    model: 'pro',
    systemInstruction: SECTION_SYSTEM,
    userPrompt,
    responseSchema: SECTION_RESPONSE_SCHEMA,
    temperature: 0.7,
  });

  const parsed = parseJsonResponse<{
    sections: Array<{
      order_index: number;
      duration_seconds: number;
      image_prompt: string;
      video_prompt: string;
      script_text: string;
    }>;
  }>(text);

  // 길이 합 검증
  const total = parsed.sections.reduce((sum, s) => sum + s.duration_seconds, 0);
  if (Math.abs(total - video.durationSeconds) > 1) {
    throw new Error(
      `Section duration sum (${total}s) does not match video duration (${video.durationSeconds}s)`
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.section.deleteMany({ where: { videoId } });
    const rows = await Promise.all(
      parsed.sections.map((s) =>
        tx.section.create({
          data: {
            videoId,
            orderIndex: s.order_index,
            durationSeconds: s.duration_seconds,
            imagePrompt: s.image_prompt,
            videoPrompt: s.video_prompt,
            scriptText: s.script_text,
          },
        })
      )
    );
    await tx.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.SECTIONS_READY, selectedScenarioId: scenarioId },
    });
    return rows;
  });

  return created;
}

// ─── 이미지 기반 video_prompt 재생성 ─────────────────────────────

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function regenerateVideoPromptFromImage(sectionId: string): Promise<{ before: string; after: string }> {
  const section = await prisma.section.findUniqueOrThrow({ where: { id: sectionId } });
  if (!section.sourceImagePath) {
    throw new Error('이 섹션에 업로드된 이미지가 없습니다. 먼저 콘티 이미지를 업로드하세요.');
  }

  const ext = path.extname(section.sourceImagePath).toLowerCase();
  const mimeType = IMAGE_MIME_BY_EXT[ext];
  if (!mimeType) {
    throw new Error(`지원하지 않는 이미지 형식: ${ext}`);
  }

  const buffer = await fs.readFile(section.sourceImagePath);
  const base64Data = buffer.toString('base64');

  const { text, modelUsed } = await callGemini({
    model: 'flash',
    systemInstruction: VIDEO_FROM_IMAGE_SYSTEM,
    userPrompt: buildVideoFromImagePrompt({
      scriptText: section.scriptText,
      durationSeconds: section.durationSeconds,
      originalImagePrompt: section.imagePrompt,
    }),
    imageInput: { mimeType, base64Data },
    temperature: 0.5,
  });

  const cleaned = text.trim().replace(/^["'`]+|["'`]+$/g, '');
  const provider: LLMProvider = modelUsed.includes('flash') ? 'GEMINI_FLASH' : 'GEMINI_PRO';

  await prisma.$transaction(async (tx) => {
    await tx.trimHistory.create({
      data: {
        sectionId,
        field: TrimField.VIDEO_PROMPT,
        beforeText: section.videoPrompt,
        afterText: cleaned,
        userInstruction: '[이미지 기반 자동 재생성]',
        llmUsed: provider,
      },
    });
    await tx.section.update({
      where: { id: sectionId },
      data: { videoPrompt: cleaned },
    });
  });

  return { before: section.videoPrompt, after: cleaned };
}

/** 기존 섹션에 image_prompt가 비어있으면 LLM으로 채워주기 (이미 만든 영상의 backfill용) */
export async function backfillImagePromptForSection(sectionId: string): Promise<string> {
  const section = await prisma.section.findUniqueOrThrow({
    where: { id: sectionId },
    include: { video: { include: { project: true, sections: { orderBy: { orderIndex: 'asc' } } } } },
  });

  const sys = `당신은 마케팅 쇼츠 콘티 이미지 프롬프트 전문가다.

규칙:
- 입력된 섹션의 스크립트와 영상 프롬프트를 보고, 이 섹션의 첫 프레임 이미지를 만들기 위한 영문 이미지 프롬프트 1개를 작성.
- 9:16 vertical aspect 명시.
- 단일 정지 장면. 카메라 각도/구도/조명/스타일/주요 객체/색감을 구체적으로.
- **구조 두 부분으로 작성**:
  (a) STYLE TOKENS — 다른 섹션들과 **글자 그대로 동일**하게 유지하는 스타일 가이드. 다음을 모두 포함:
      - rendering medium (photographic / 3D / illustration / anime 중 하나)
      - texture/material treatment (film grain, smooth matte, glossy 등)
      - lighting, color palette, 캐릭터 외형(있다면)
  → 다른 섹션 image_prompt에서 (a) 부분을 추출해 **그대로 복사**해서 사용. 변경하지 말 것.
  (b) SCENE DESCRIPTION — 이 섹션의 **고유 장면**. 반드시 다른 섹션과 다른 카메라 앵글/액션/객체/순간을 묘사.
- **절대 금지**: 다른 섹션의 image_prompt와 동일하거나 거의 동일한 결과 반환. 시나리오의 흐름에서 이 섹션이 차지하는 시각적 위치를 반영하라.
- **반드시 지킬 것**: STYLE TOKENS는 다른 섹션과 글자 단위로 동일 (한 글자라도 다르면 콘티 일관성 깨짐).
- 응답은 image_prompt 텍스트만. 설명/마크다운/따옴표 금지.`;

  const otherSections = section.video.sections
    .filter((s) => s.id !== sectionId && s.imagePrompt)
    .map((s) => `- 섹션 ${s.orderIndex} image_prompt: ${s.imagePrompt}`)
    .join('\n');

  const userPrompt = `# 앱
${section.video.project.appName}

# 이 섹션
순서: ${section.orderIndex}
길이: ${section.durationSeconds}초
자막: ${section.scriptText}
영상 프롬프트: ${section.videoPrompt}

# 같은 영상의 다른 섹션 이미지 프롬프트 (일관성 참고)
${otherSections || '(없음)'}

# 요청
이 섹션의 첫 프레임 이미지를 만들기 위한 영문 image_prompt 1개.`;

  const { text } = await callGemini({
    model: 'flash',
    systemInstruction: sys,
    userPrompt,
    temperature: 0.7,
  });

  const cleaned = text.trim().replace(/^["'`]+|["'`]+$/g, '');
  await prisma.section.update({ where: { id: sectionId }, data: { imagePrompt: cleaned } });
  return cleaned;
}

// ─── 3. Trim — 섹션의 한 필드를 사용자 지시로 다듬기 ────────────────

export async function trimSectionField(
  sectionId: string,
  field: TrimField,
  userInstruction: string
) {
  const section = await prisma.section.findUniqueOrThrow({
    where: { id: sectionId },
    include: { video: { include: { project: true } } },
  });
  const totalSections = await prisma.section.count({ where: { videoId: section.videoId } });

  const currentText = field === TrimField.SCRIPT_TEXT ? section.scriptText : section.videoPrompt;

  const { text, modelUsed } = await callGemini({
    model: 'flash', // Trim은 짧은 작업이라 Flash로 비용 절감
    systemInstruction: TRIM_SYSTEM,
    userPrompt: buildTrimPrompt({
      appName: section.video.project.appName,
      field: field === TrimField.SCRIPT_TEXT ? 'SCRIPT_TEXT' : 'VIDEO_PROMPT',
      currentText,
      userInstruction,
      orderIndex: section.orderIndex,
      totalSections,
      durationSeconds: section.durationSeconds,
    }),
    temperature: 0.6,
  });

  const cleaned = text.trim().replace(/^["'`]+|["'`]+$/g, '');

  const provider: LLMProvider = modelUsed.includes('flash') ? 'GEMINI_FLASH' : 'GEMINI_PRO';

  await prisma.$transaction(async (tx) => {
    await tx.trimHistory.create({
      data: {
        sectionId,
        field,
        beforeText: currentText,
        afterText: cleaned,
        userInstruction,
        llmUsed: provider,
      },
    });
    await tx.section.update({
      where: { id: sectionId },
      data: field === TrimField.SCRIPT_TEXT ? { scriptText: cleaned } : { videoPrompt: cleaned },
    });
    await tx.video.update({
      where: { id: section.videoId },
      data: { status: VideoStatus.TRIMMING },
    });
  });

  return { before: currentText, after: cleaned };
}

// ─── 4. 사용자 수동 편집 (LLM 호출 없음) ─────────────────────────────

export async function manualEditSection(
  sectionId: string,
  field: TrimField,
  newText: string
) {
  const section = await prisma.section.findUniqueOrThrow({ where: { id: sectionId } });
  const before = field === TrimField.SCRIPT_TEXT ? section.scriptText : section.videoPrompt;

  await prisma.$transaction(async (tx) => {
    await tx.trimHistory.create({
      data: {
        sectionId,
        field,
        beforeText: before,
        afterText: newText,
        userInstruction: '[수동 편집]',
        llmUsed: LLMProvider.MANUAL_EDIT,
      },
    });
    await tx.section.update({
      where: { id: sectionId },
      data: field === TrimField.SCRIPT_TEXT ? { scriptText: newText } : { videoPrompt: newText },
    });
    await tx.video.update({
      where: { id: section.videoId },
      data: { status: VideoStatus.TRIMMING },
    });
  });
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────

/** 영상 길이별 권장 섹션 수 (15-20초 = 3-4개) */
function recommendSectionCount(durationSeconds: number): number {
  if (durationSeconds <= 12) return 3;
  if (durationSeconds <= 22) return 4;
  if (durationSeconds <= 35) return 5;
  return 6;
}
