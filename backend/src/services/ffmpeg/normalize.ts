import ffmpeg from 'fluent-ffmpeg';
import { env } from '../../config/env.js';

if (env.FFMPEG_PATH) ffmpeg.setFfmpegPath(env.FFMPEG_PATH);
if (env.FFPROBE_PATH) ffmpeg.setFfprobePath(env.FFPROBE_PATH);

/**
 * 입력 영상을 지정 크기로 정규화. 원본 비율과 다르면 블러 패딩으로 채움 (절대 크롭 없음).
 * 오디오 트랙은 제거 (별도 음성 파일과 합칠 예정).
 *
 * @param targetWidth  목표 너비 (Type 1: 1080, Type 2: 1080)
 * @param targetHeight 목표 높이 (Type 1: 1920, Type 2: 1500 — 상단 검정 띠 제외 영역)
 */
export async function normalizeToFit(
  inputPath: string,
  outputPath: string,
  targetWidth: number,
  targetHeight: number,
  durationSeconds: number,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .complexFilter(
        [
          // 1) 원본을 main / bg 두 갈래로 분기
          '[0:v]split=2[main][bg]',
          // 2) bg: target 크기 채울 만큼 확대 → 크롭 → 박스 블러 (배경용)
          `[bg]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},boxblur=40:1[bgblur]`,
          // 3) main: 비율 유지하면서 target 안에 들어가게 축소 (콘텐츠 100% 보존)
          `[main]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease[fitted]`,
          // 4) bg 위에 main 중앙 정렬 overlay
          '[bgblur][fitted]overlay=(W-w)/2:(H-h)/2[v]',
          // 5) fps 30 통일, SAR=1, yuv420p (호환성 최대)
          '[v]fps=30,setsar=1,format=yuv420p[vout]',
        ],
        ['vout']
      )
      .videoCodec('libx264')
      .outputOptions([
        '-preset', 'medium',
        '-crf', '20',
        '-profile:v', 'high',
        '-level', '4.0',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-an',
        '-t', String(durationSeconds),
      ])
      .on('progress', (p) => {
        if (onProgress && typeof p.percent === 'number') {
          onProgress(Math.min(100, Math.max(0, p.percent)));
        }
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`normalize failed: ${err.message}`)))
      .save(outputPath);
  });
}

/** Type 1 (9:16 풀화면) 정규화 — 호환용 래퍼 */
export async function normalizeToVertical(
  inputPath: string,
  outputPath: string,
  durationSeconds: number,
  onProgress?: (pct: number) => void
): Promise<void> {
  return normalizeToFit(inputPath, outputPath, 1080, 1920, durationSeconds, onProgress);
}

export type VideoProbe = {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
};

export async function probeVideo(inputPath: string): Promise<VideoProbe> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const v = metadata.streams.find((s) => s.codec_type === 'video');
      if (!v) return reject(new Error('No video stream found'));
      const [num, den] = (v.r_frame_rate ?? '30/1').split('/').map(Number);
      resolve({
        durationSeconds: metadata.format.duration ?? 0,
        width: v.width ?? 0,
        height: v.height ?? 0,
        fps: den ? num / den : 30,
        codec: v.codec_name ?? 'unknown',
      });
    });
  });
}

export async function probeAudio(inputPath: string): Promise<{ durationSeconds: number; codec: string }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const a = metadata.streams.find((s) => s.codec_type === 'audio');
      resolve({
        durationSeconds: metadata.format.duration ?? 0,
        codec: a?.codec_name ?? 'unknown',
      });
    });
  });
}
