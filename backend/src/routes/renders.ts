import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { RenderJobStatus, VideoStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../auth/auth.js';
import { enqueueRender } from '../services/queue/pgboss.js';

const router = Router();
router.use(requireAuth);

// ── 렌더 큐잉 ──
router.post('/videos/:videoId/render', async (req, res) => {
  const video = await prisma.video.findUnique({
    where: { id: req.params.videoId },
    include: { sections: true },
  });
  if (!video) {
    res.status(404).json({ error: 'video_not_found' });
    return;
  }
  if (!video.sections.length) {
    res.status(400).json({ error: 'no_sections' });
    return;
  }
  const missing = video.sections.filter((s) => !s.sourceVideoPath || !s.sourceAudioPath);
  if (missing.length) {
    res.status(400).json({
      error: 'assets_incomplete',
      missingSections: missing.map((s) => s.orderIndex),
    });
    return;
  }

  // RenderJob 행 먼저 생성 → 그 ID를 큐 payload에 담음
  const renderJob = await prisma.renderJob.create({
    data: {
      videoId: video.id,
      pgBossJobId: 'pending',
      status: RenderJobStatus.QUEUED,
    },
  });

  const bossId = await enqueueRender({
    videoId: video.id,
    renderJobId: renderJob.id,
  });

  await prisma.renderJob.update({
    where: { id: renderJob.id },
    data: { pgBossJobId: bossId },
  });
  await prisma.video.update({
    where: { id: video.id },
    data: { status: VideoStatus.RENDERING },
  });

  res.status(202).json({ renderJobId: renderJob.id, pgBossJobId: bossId });
});

// ── 렌더 작업 상태 조회 ──
router.get('/jobs/:id', async (req, res) => {
  const j = await prisma.renderJob.findUnique({
    where: { id: req.params.id },
    include: { artifacts: true },
  });
  if (!j) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(j);
});

// ── 영상의 모든 렌더 결과(version 목록) ──
router.get('/videos/:videoId/artifacts', async (req, res) => {
  const list = await prisma.renderArtifact.findMany({
    where: { videoId: req.params.videoId },
    orderBy: { version: 'desc' },
  });
  res.json(list);
});

// ── 산출물 다운로드 (스트리밍) ──
router.get('/artifacts/:id/download', async (req, res) => {
  const a = await prisma.renderArtifact.findUnique({ where: { id: req.params.id } });
  if (!a) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  if (!fs.existsSync(a.filePath)) {
    res.status(410).json({ error: 'file_missing_on_disk' });
    return;
  }
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${path.basename(a.filePath)}"`
  );
  fs.createReadStream(a.filePath).pipe(res);
});

// ── 썸네일 조회 ──
router.get('/videos/:videoId/thumbnail', async (req, res) => {
  const v = await prisma.video.findUnique({ where: { id: req.params.videoId } });
  if (!v?.thumbnailPath || !fs.existsSync(v.thumbnailPath)) {
    res.status(404).json({ error: 'no_thumbnail' });
    return;
  }
  res.setHeader('Content-Type', 'image/jpeg');
  fs.createReadStream(v.thumbnailPath).pipe(res);
});

export default router;
