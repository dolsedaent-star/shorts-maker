/**
 * 렌더 큐 워커. API 서버와 별도 프로세스로 실행.
 *
 *   npm run worker
 *
 * pg-boss 큐를 polling → renderVideo() 실행 → RenderJob/Video 상태 갱신.
 */

import 'dotenv/config';
import { RenderJobStatus, VideoStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { renderVideo } from '../ffmpeg/render.js';
import { getBoss, RENDER_QUEUE, type RenderJobPayload } from './pgboss.js';

async function main() {
  const boss = await getBoss();
  console.log(`[worker] started, subscribed to "${RENDER_QUEUE}"`);

  await boss.work<RenderJobPayload>(
    RENDER_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 2 }, // FFmpeg는 CPU heavy → 한 번에 1개만 (v10 API)
    async (jobs) => {
      // pg-boss v10: handler는 job 배열을 받음. batchSize=1이라 항상 [job]
      const job = jobs[0];
      const { videoId, renderJobId } = job.data;
      console.log(`[worker] start job=${renderJobId} video=${videoId}`);

      await prisma.renderJob.update({
        where: { id: renderJobId },
        data: { status: RenderJobStatus.PROCESSING, startedAt: new Date() },
      });
      await prisma.video.update({
        where: { id: videoId },
        data: { status: VideoStatus.RENDERING },
      });

      let lastUpdatedPct = -1;

      try {
        const result = await renderVideo(videoId, renderJobId, (progress) => {
          // 5% 단위로만 DB 갱신 (fire-and-forget)
          if (progress.pct - lastUpdatedPct >= 5 || progress.pct === 100) {
            lastUpdatedPct = progress.pct;
            prisma.renderJob
              .update({
                where: { id: renderJobId },
                data: { progressPct: progress.pct, currentStep: progress.step },
              })
              .catch((err) => console.error('[worker] progress update failed:', err));
          }
        });

        await prisma.renderJob.update({
          where: { id: renderJobId },
          data: {
            status: RenderJobStatus.SUCCEEDED,
            progressPct: 100,
            currentStep: '완료',
            finishedAt: new Date(),
          },
        });
        console.log(`[worker] done job=${renderJobId} artifact=${result.artifactId} v${result.version}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[worker] FAILED job=${renderJobId}:`, msg);
        await prisma.renderJob.update({
          where: { id: renderJobId },
          data: {
            status: RenderJobStatus.FAILED,
            errorMessage: msg,
            finishedAt: new Date(),
          },
        });
        await prisma.video.update({
          where: { id: videoId },
          data: { status: VideoStatus.FAILED },
        });
        throw err; // pg-boss retry 적용 (retryLimit=1)
      }
    }
  );

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, shutting down`);
    await boss.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
