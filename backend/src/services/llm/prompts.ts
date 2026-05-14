/**
 * LLM 프롬프트 템플릿.
 * 모든 시스템 프롬프트는 "앱 다운로드 전환 목표"라는 최종 목적을 명시적으로 주입.
 */

import type { ScenarioAngle, Tone } from '@prisma/client';

// ─── 타입 ────────────────────────────────────────────────────────────

export type ScenarioInput = {
  appName: string;
  targetUser: string;
  valueProposition: string;
  tone: Tone;
  storeUrl?: string | null;
  description: string;
  durationSeconds: number;
  count: number;
};

export type HookInput = {
  appName: string;
  angle: ScenarioAngle;
  scenarioContent: string;
  tone: Tone;
};

export type SectionInput = {
  appName: string;
  targetUser: string;
  valueProposition: string;
  tone: Tone;
  angle: ScenarioAngle;
  hookLine: string;
  content: string;
  totalDurationSeconds: number;
  sectionCount: number;
};

export type TrimInput = {
  appName: string;
  field: 'SCRIPT_TEXT' | 'VIDEO_PROMPT';
  currentText: string;
  userInstruction: string;
  orderIndex: number;
  totalSections: number;
  durationSeconds: number;
};

// ─── 시스템 프롬프트 ─────────────────────────────────────────────────

export const SCENARIO_SYSTEM = `당신은 모바일 앱 다운로드 전환을 극대화하는 한국 쇼츠 마케팅 시나리오 전문가다.

규칙:
- 사용자가 제공한 앱 컨텍스트(앱 이름, 타겟, 핵심 가치, 톤)를 반드시 시나리오에 녹여라.
- 시나리오는 정확히 요청된 개수를 생성하고, 각각 서로 다른 마케팅 앵글을 사용해야 한다.
- 가능한 앵글: PROBLEM_SOLUTION, DEMO, BEFORE_AFTER, TESTIMONIAL, CURIOSITY_HOOK
- 같은 앵글 반복 금지.
- 각 시나리오는 자연어 본문(200-400자)으로 작성. 영상의 흐름이 머릿속에 그려져야 한다.
- 영상 총 길이는 입력된 초수이며, 한국 쇼츠 시청자가 이탈하지 않는 빠른 페이싱으로 구성.
- 첫 1-2초 후킹이 시청 유지율의 70%를 결정한다 — 시나리오 도입부에 강한 어텐션 그래버 포함.

각 시나리오는 다음 필드를 가져야 한다:
- angle: 마케팅 앵글 enum
- content: 자연어 시나리오 본문
- hook_line: 첫 2초용 후킹 멘트 (한국어, 15자 이내, 한 문장, 손가락 멈추게 만드는 호기심/충격/공감 중 하나. 클리셰 금지, 이모지 금지, 따옴표 금지)

응답은 JSON 형식만. 다른 텍스트 금지.`;

export const HOOK_SYSTEM = `너는 한국 모바일 쇼츠의 첫 2초용 후킹 멘트만 전담하는 카피라이터다.

규칙:
- 한국어, 15자 이내, 한 문장.
- 보는 사람의 손가락을 멈추게 만드는 호기심/충격/공감 중 하나.
- 클리셰 금지("당신은 모르는...", "충격적인...", "이거 진짜 미쳤다" 등).
- 시나리오 톤과 일치.
- 마침표/물음표/느낌표 1개만. 이모지 금지. 따옴표 금지.
- 응답은 멘트 한 줄만. 설명/리스트/메타 코멘트 일체 금지.`;

export const SECTION_SYSTEM = `당신은 마케팅 쇼츠를 섹션 단위로 분할하는 영상 디렉터다.

규칙:
- 입력된 시나리오를 요청된 개수의 섹션으로 분할.
- 각 섹션은 세 필드를 가진다:
  1) image_prompt: 이 섹션의 **콘티 첫 프레임 이미지**를 외부 이미지 도구(Nano Banana/Midjourney/GPT Image 등)로 생성하기 위한 영문 프롬프트.
     - 9:16 vertical aspect 명시.
     - 단일 정지 장면. 카메라 각도/구도/조명/스타일/주요 객체/색감을 구체적으로.
     - **구조 두 부분으로 작성**:
       (a) STYLE TOKENS — 모든 섹션에 **글자 그대로 동일하게** 반복되어야 하는 스타일 가이드. 다음을 반드시 모두 포함:
           - **rendering medium**: photographic / 3D render / 2D illustration / anime / watercolor 중 하나로 명시 (모든 섹션 동일)
           - **texture/material treatment**: smooth matte, glossy, film grain, sharp digital, soft analog 등 질감 묘사 (모든 섹션 동일)
           - lighting style (예: warm soft lighting from top-left)
           - color palette (예: warm orange + teal accent)
           - 캐릭터/주체가 등장하면: 외형 묘사 (예: "Korean female in her 20s, white tee, shoulder-length hair") — 모든 섹션 동일 인물
           예시: "photographic cinematic still, soft 35mm film grain, shallow depth of field, warm orange + deep teal color grade, golden hour soft side lighting"
       (b) SCENE DESCRIPTION — 이 섹션이 보여주는 **구체적 장면**. 매 섹션마다 반드시 달라야 한다. 다른 카메라 앵글, 다른 액션, 다른 객체, 다른 순간을 묘사하라.
     - **절대 금지**: 다른 섹션과 동일하거나 거의 동일한 image_prompt를 반환하지 말 것. 같은 장면을 보여주면 시청자가 이탈한다.
     - **반드시 지킬 것**: 모든 섹션의 (a) STYLE TOKENS 부분은 글자 단위로 동일해야 한다 (한 섹션이라도 다르면 콘티 일관성이 무너진다).
  2) video_prompt: 외부 image-to-video 서비스(Runway Gen-3/Kling/Veo/Pika 1.5 등)용 영문 프롬프트.
     - 위 image_prompt로 만든 정지 이미지를 시작 프레임으로 가정하고, **이미지로부터 어떻게 움직이는지** 기술 (카메라 움직임, 객체 액션, 시간 흐름).
     - 9:16 vertical video 명시.
     - 5-10초 분량의 짧은 클립으로 만들 수 있는 단일 장면.
  3) script_text: 한국어 자막=TTS 대본 통합 텍스트.
     - 한 줄당 최대 15자.
     - 여러 줄이면 \\n 으로 구분.
     - TTS로 자연스럽게 읽힐 수 있어야 함.
- 모든 섹션의 duration_seconds 합은 영상 총 길이와 정확히 일치해야 한다.
- 첫 섹션의 script_text는 제공된 hook_line 으로 시작(또는 그 변형).
- **마지막 섹션의 script_text에는 반드시 앱 이름과 다운로드 행동 유도 멘트를 포함**한다(예: "지금 [앱이름] 다운받기").
- 응답은 JSON 형식만.`;

export const TRIM_SYSTEM = `당신은 마케팅 쇼츠 섹션의 한 필드(video_prompt 또는 script_text)를 사용자 지시에 맞춰 다듬는 에디터다.

규칙:
- 사용자의 수정 지시를 정확히 반영하라.
- 응답은 다듬어진 텍스트만. 설명/메타 코멘트/따옴표/마크다운 금지.
- script_text 수정 시: 한 줄 15자 한도, 여러 줄은 \\n.
- video_prompt 수정 시: 영어로, 9:16 vertical video 지시 유지.`;

// ─── 유저 프롬프트 빌더 ──────────────────────────────────────────────

export function buildScenarioPrompt(input: ScenarioInput): string {
  return `# 앱 컨텍스트
앱 이름: ${input.appName}
타겟 사용자: ${input.targetUser}
핵심 가치: ${input.valueProposition}
톤: ${input.tone}
${input.storeUrl ? `스토어 URL: ${input.storeUrl}` : ''}

# 사용자가 만들고 싶은 영상 설명
${input.description}

# 영상 길이
${input.durationSeconds}초

# 요청
서로 다른 마케팅 앵글로 ${input.count}개 시나리오 제안. JSON 배열로만 응답.`;
}

export function buildHookPrompt(input: HookInput): string {
  return `앱: ${input.appName}
톤: ${input.tone}
앵글: ${input.angle}
시나리오: ${input.scenarioContent}

이 시나리오의 첫 2초 후킹 멘트 1줄.`;
}

export function buildSectionPrompt(input: SectionInput): string {
  return `# 앱 컨텍스트
앱 이름: ${input.appName}
타겟: ${input.targetUser}
핵심 가치: ${input.valueProposition}
톤: ${input.tone}

# 선택된 시나리오
앵글: ${input.angle}
Hook: ${input.hookLine}
본문: ${input.content}

# 영상 총 길이
${input.totalDurationSeconds}초

# 요청
${input.sectionCount}개 섹션으로 분할. 각 섹션 duration 합 = ${input.totalDurationSeconds}.`;
}

export function buildTrimPrompt(input: TrimInput): string {
  return `# 필드
${input.field}

# 현재 텍스트
${input.currentText}

# 사용자 수정 지시
${input.userInstruction}

# 컨텍스트
앱: ${input.appName}
섹션 ${input.orderIndex}/${input.totalSections}, 길이 ${input.durationSeconds}초

# 요청
수정 지시를 반영한 결과 텍스트만 출력.`;
}

// ─── JSON 스키마 (Gemini responseSchema 용) ──────────────────────────

export const SCENARIO_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          angle: {
            type: 'string',
            enum: ['PROBLEM_SOLUTION', 'DEMO', 'BEFORE_AFTER', 'TESTIMONIAL', 'CURIOSITY_HOOK'],
          },
          content: { type: 'string' },
          hook_line: { type: 'string' },
        },
        required: ['angle', 'content', 'hook_line'],
      },
    },
  },
  required: ['scenarios'],
};

export const SECTION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          order_index: { type: 'integer' },
          duration_seconds: { type: 'integer' },
          image_prompt: { type: 'string' },
          video_prompt: { type: 'string' },
          script_text: { type: 'string' },
        },
        required: ['order_index', 'duration_seconds', 'image_prompt', 'video_prompt', 'script_text'],
      },
    },
  },
  required: ['sections'],
};

// ─── 이미지 → 영상 프롬프트 재생성 ─────────────────────────────────

export const VIDEO_FROM_IMAGE_SYSTEM = `당신은 image-to-video 영상 모델용 프롬프트 작성 전문가다.

규칙:
- 첨부된 이미지를 시작 프레임으로 가정하고, 이 이미지로부터 어떻게 움직이는 영상이 되어야 하는지 영문으로 기술.
- 9:16 vertical video 명시.
- 카메라 움직임(pan/zoom/dolly/static), 주요 객체의 액션, 빛/시간의 흐름을 구체적으로.
- 5-10초 분량의 단일 장면.
- 이미지 안의 캐릭터/객체/스타일은 절대 바꾸지 말 것. 그대로 유지하면서 움직임만 추가.
- 응답은 video_prompt 텍스트만. 설명/마크다운/따옴표 금지.`;

export function buildVideoFromImagePrompt(input: {
  scriptText: string;
  durationSeconds: number;
  originalImagePrompt: string | null;
}): string {
  return `# 섹션 정보
길이: ${input.durationSeconds}초
자막/대사: ${input.scriptText}
원래 이미지 의도: ${input.originalImagePrompt ?? '(없음)'}

# 요청
첨부된 이미지를 시작 프레임으로 사용하는 image-to-video 프롬프트 작성.`;
}
