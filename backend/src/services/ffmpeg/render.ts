import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { VideoStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import {
  ensureRenderDir,
  renderArtifactPath,
  sectionProcessedPath,
  thumbnailPath as thumbPathFor,
} from '../../lib/paths.js';
import { resolveSubtitleStyle } from '../../lib/subtitleStyle.js';
import { normalizeToVertical, probeAudio, probeVideo } from './normalize.js';
import { generateAssFile, type SubtitleSection } from './subtitles.js';
import { extractThumbnail } from './thumbnail.js';

if (env.FFMPEG_PATH) ffmpeg.setFfmpegPath(env.FFMPEG_PATH);

export type RenderProgress = { step: string; pct: number };

/**
 * 영상 1편 전체 렌더링 파이프라인.
 *
 * 단계:
 *  1) 자산 검증 (영상/음성 존재, 음성-섹션 길이 매칭 ±0.5s)  ← 옵션 C 정책
 *  2) 각 섹션 영상을 1080x1920 정규화 (블러 패딩)
 *  3) 영상 concat (이미 동일 코덱/해상도라 -c copy)
 *  4) 음성 concat (재인코딩, AAC 192k 44.1kHz stereo)
 *  5) ASS 자막 생성
 *  6) 최종 mux + 자막 burn
 *  7) 썸네일 추출
 *  8) RenderArtifact 생성 (version 누적), Video.status=DONE
 */
export async function renderVideo(
  videoId: string,
  renderJobId: string,
  onProgress?: (p: RenderProgress) => void
): Promise<{ artifactId: string; filePath: string; version: number }> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: {
      project: true,
      sections: { orderBy: { orderIndex: 'asc' } },
    },
  });

  if (!video.sections.length) throw new Error('No sections to render');

  // ── 1) 자산 검증 (음성: 짧으면 자동 패딩 OK, 길면 에러) ─────────
  for (const s of video.sections) {
    if (!s.sourceVideoPath) {
      throw new Error(`Section ${s.orderIndex}: missing source video`);
    }
    if (!s.sourceAudioPath) {
      throw new Error(`Section ${s.orderIndex}: missing source audio`);
    }
    const audioMeta = await probeAudio(s.sourceAudioPath);
    const overshoot = audioMeta.durationSeconds - s.durationSeconds;
    if (overshoot > 0.5) {
      throw new Error(
        `Section ${s.orderIndex}: audio is ${overshoot.toFixed(2)}s LONGER than section ` +
          `(${audioMeta.durationSeconds.toFixed(2)}s vs ${s.durationSeconds}s). ` +
          `대사를 줄이거나 빠르게 말하는 TTS로 재생성 후 업로드하세요.`
      );
    }
    // 짧은 건 OK — 뒤에 무음으로 자동 패딩됨
  }

  await ensureRenderDir(videoId);
  const renderDir = path.join(env.STORAGE_BASE_PATH, 'videos', videoId, 'renders');
  const sectionCount = video.sections.length;

  // ── 2) 섹션별 정규화 (전체 진행률의 0-50%) ──────────────────────
  const processedPaths: string[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const s = video.sections[i];
    const procPath = sectionProcessedPath(videoId, s.id);
    await normalizeToVertical(s.sourceVideoPath!, procPath, s.durationSeconds, (pct) => {
      const overall = (i / sectionCount) * 50 + (pct / 100) * (50 / sectionCount);
      onProgress?.({ step: `정규화 ${i + 1}/${sectionCount}`, pct: Math.round(overall) });
    });
    await prisma.section.update({
      where: { id: s.id },
      data: { processedVideoPath: procPath },
    });
    processedPaths.push(procPath);
  }

  // ── 3) 영상 concat ───────────────────────────────────────────────
  const videoConcatFile = path.join(renderDir, '_concat-video.txt');
  await fs.writeFile(
    videoConcatFile,
    processedPaths.map((p) => `file '${toConcatPath(p)}'`).join('\n'),
    'utf-8'
  );
  const concatVideoPath = path.join(renderDir, '_concat-video.mp4');
  await runFfmpeg((cmd) =>
    cmd
      .input(videoConcatFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
      .save(concatVideoPath)
  );
  onProgress?.({ step: '영상 합치기 완료', pct: 55 });

  // ── 4) 음성 concat (각 섹션을 정확한 길이로 패딩/트림 후 합침) ─
  // 짧은 음성은 끝에 무음 패딩, 약간 긴 음성은 잘림. 섹션 길이 합 = 영상 길이.
  const concatAudioPath = path.join(renderDir, '_concat-audio.m4a');
  await runFfmpeg((cmd) => {
    video.sections.forEach((s) => cmd.input(s.sourceAudioPath!));
    const filterParts: string[] = [];
    const labels: string[] = [];
    video.sections.forEach((s, i) => {
      // apad: 짧으면 무음으로 채움 / atrim: 정확히 섹션 길이로 잘라냄 / asetpts: 타임스탬프 0부터
      filterParts.push(
        `[${i}:a]apad=whole_dur=${s.durationSeconds},atrim=0:${s.durationSeconds},asetpts=PTS-STARTPTS[a${i}]`
      );
      labels.push(`[a${i}]`);
    });
    filterParts.push(`${labels.join('')}concat=n=${video.sections.length}:v=0:a=1[mixed]`);
    return cmd
      .complexFilter(filterParts, ['mixed'])
      .audioCodec('aac')
      .audioBitrate('192k')
      .outputOptions(['-ar', '44100', '-ac', '2'])
      .save(concatAudioPath);
  });
  onProgress?.({ step: '음성 합치기 완료 (자동 패딩 포함)', pct: 70 });

  // ── 4.5) BGM 믹스 (선택, 사이드체인 더킹 + 페이드아웃) ───────────
  let finalAudioPath = concatAudioPath;
  if (video.bgmPath) {
    const bgmMixedPath = path.join(renderDir, '_dialogue-bgm-mix.m4a');
    const duration = video.durationSeconds;
    const fadeStart = Math.max(0, duration - 1.5);

    await runFfmpeg((cmd) =>
      cmd
        .input(concatAudioPath)
        .input(video.bgmPath!)
        .complexFilter(
          [
            // BGM 원본 처리: 무한 루프(영상보다 짧으면 채움) → 영상 길이로 잘림 → 마지막 1.5초 페이드아웃
            `[1:a]aloop=loop=-1:size=2e9,atrim=0:${duration},afade=t=out:st=${fadeStart}:d=1.5,volume=0.6[bgm_raw]`,
            // 대사를 두 갈래로: 하나는 출력용, 하나는 사이드체인 트리거용
            `[0:a]asplit=2[dialogue_out][dialogue_sc]`,
            // 사이드체인 컴프레서 — 대사가 들릴 때마다 BGM이 자동으로 -18dB 정도 죽음
            `[bgm_raw][dialogue_sc]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=400:makeup=1[bgm_ducked]`,
            // 대사 + 더킹된 BGM 합성
            `[dialogue_out][bgm_ducked]amix=inputs=2:duration=first:normalize=0[mixed]`,
          ],
          ['mixed']
        )
        .audioCodec('aac')
        .audioBitrate('192k')
        .outputOptions(['-ar', '44100', '-ac', '2'])
        .save(bgmMixedPath)
    );
    finalAudioPath = bgmMixedPath;
    onProgress?.({ step: 'BGM 더킹 합성 완료', pct: 75 });
  }

  // ── 5) ASS 자막 생성 ─────────────────────────────────────────────
  const style = resolveSubtitleStyle(video.subtitleStyleOverride, video.project.subtitleStyle);
  let cursor = 0;
  const subSections: SubtitleSection[] = video.sections.map((s) => {
    const start = cursor;
    cursor += s.durationSeconds;
    return { startSec: start, endSec: cursor, text: s.scriptText };
  });
  const assPath = path.join(renderDir, '_subtitle.ass');
  await fs.writeFile(assPath, generateAssFile(subSections, style), 'utf-8');

  // ── 6) 최종 mux + 자막 burn (70-95%) ─────────────────────────────
  const version = await nextRenderVersion(videoId);
  const finalPath = renderArtifactPath(videoId, version);

  await runFfmpeg((cmd) =>
    cmd
      .input(concatVideoPath)
      .input(finalAudioPath)
      .videoFilter(`subtitles=${escapeSubtitlesPath(assPath)}`)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset', 'medium',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-shortest',
      ])
      .on('progress', (p) => {
        if (typeof p.percent === 'number') {
          onProgress?.({
            step: '최종 렌더링 + 자막 번인',
            pct: Math.round(70 + (Math.min(100, p.percent) / 100) * 25),
          });
        }
      })
      .save(finalPath)
  );

  // ── 7) 썸네일 ────────────────────────────────────────────────────
  const thumbPath = thumbPathFor(videoId, version);
  await extractThumbnail(finalPath, thumbPath, Math.min(2, video.durationSeconds / 4));
  onProgress?.({ step: '썸네일 생성', pct: 98 });

  // ── 8) DB 기록 ──────────────────────────────────────────────────
  const stat = await fs.stat(finalPath);
  const finalMeta = await probeVideo(finalPath);

  const artifact = await prisma.$transaction(async (tx) => {
    const a = await tx.renderArtifact.create({
      data: {
        videoId,
        version,
        filePath: finalPath,
        fileSizeBytes: BigInt(stat.size),
        durationActualSeconds: finalMeta.durationSeconds,
        renderJobId,
      },
    });
    await tx.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.DONE, thumbnailPath: thumbPath },
    });
    return a;
  });

  // 임시 concat 파일 정리 (실패 시 무시)
  await Promise.allSettled([
    fs.unlink(videoConcatFile),
    fs.unlink(concatVideoPath),
    fs.unlink(concatAudioPath),
    finalAudioPath !== concatAudioPath ? fs.unlink(finalAudioPath) : Promise.resolve(),
  ]);

  onProgress?.({ step: '완료', pct: 100 });
  return { artifactId: artifact.id, filePath: finalPath, version };
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────

async function nextRenderVersion(videoId: string): Promise<number> {
  const last = await prisma.renderArtifact.findFirst({
    where: { videoId },
    orderBy: { version: 'desc' },
  });
  return (last?.version ?? 0) + 1;
}

function runFfmpeg(
  configure: (cmd: ReturnType<typeof ffmpeg>) => ReturnType<typeof ffmpeg>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    const built = configure(cmd);
    built.on('end', () => resolve());
    built.on('error', (err: Error) => reject(new Error(`ffmpeg: ${err.message}`)));
  });
}

/** concat demuxer 파일 내부 경로용 — Windows 백슬래시 → 슬래시 */
function toConcatPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/'/g, "\\'");
}

/**
 * subtitles 필터 인자 경로 escape.
 * Windows: 드라이브 콜론(C:) → C\:, 백슬래시 → 슬래시.
 * 전체를 작은따옴표로 감쌈.
 */
function escapeSubtitlesPath(p: string): string {
  const fwd = p.replace(/\\/g, '/').replace(/:/g, '\\:');
  return `'${fwd}'`;
}
