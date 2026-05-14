import ffmpeg from 'fluent-ffmpeg';
import { env } from '../../config/env.js';

if (env.FFMPEG_PATH) ffmpeg.setFfmpegPath(env.FFMPEG_PATH);

/**
 * 최종 영상의 특정 시점 프레임을 썸네일(JPEG)로 추출.
 * 9:16 영상이므로 540x960 (절반 해상도)으로 축소 저장.
 */
export async function extractThumbnail(
  videoPath: string,
  outputPath: string,
  timestampSeconds: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestampSeconds)
      .frames(1)
      .outputOptions(['-vf', 'scale=540:960', '-q:v', '3'])
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`thumbnail failed: ${err.message}`)))
      .save(outputPath);
  });
}
