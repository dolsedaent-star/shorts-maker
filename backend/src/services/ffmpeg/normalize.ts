import ffmpeg from 'fluent-ffmpeg';
import { env } from '../../config/env.js';

if (env.FFMPEG_PATH) ffmpeg.setFfmpegPath(env.FFMPEG_PATH);
if (env.FFPROBE_PATH) ffmpeg.setFfprobePath(env.FFPROBE_PATH);

/**
 * 입력 영상을 9:16(1080x1920) H.264로 정규화.
 * 가로/정사각 등 비표준 비율 영상은 블러 패딩으로 채움.
 * 오디오 트랙은 제거 (별도 음성 파일과 합칠 예정).
 *
 * 사용자 명시 요구: scale=1080:1920 필터로 강제 통일.
 */
export async function normalizeToVertical(
  inputPath: string,
  outputPath: string,
  durationSeconds: number,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .complexFilter(
        [
          // 1) 원본 비디오를 main / bg 두 갈래로 분기
          '[0:v]split=2[main][bg]',
          // 2) bg: 1080x1920을 채울 만큼 확대 → 크롭 → 강한 박스 블러
          '[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:1[bgblur]',
          // 3) main: 비율 유지하면서 1080x1920 안에 들어가게 축소
          '[main]scale=1080:1920:force_original_aspect_ratio=decrease[fitted]',
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
        '-an',                       // 오디오 제거
        '-t', String(durationSeconds), // 정확한 길이로 자르기 (초과분만)
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
