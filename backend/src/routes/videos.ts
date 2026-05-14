import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { VideoStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../auth/auth.js';
import { videoBgmPath, videoWorkDir } from '../lib/paths.js';
import {
  generateScenariosForVideo,
  generateSectionsForVideo,
} from '../services/llm/orchestrator.js';

const router = Router();
router.use(requireAuth);

const CreateVideo = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  durationSeconds: z.number().int().min(5).max(60),
});

router.post('/', async (req, res) => {
  const parse = CreateVideo.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body', issues: parse.error.issues });
    return;
  }
  const v = await prisma.video.create({ data: parse.data });
  res.status(201).json(v);
});

router.get('/:id', async (req, res) => {
  const v = await prisma.video.findUnique({
    where: { id: req.params.id },
    include: {
      project: true,
      scenarios: { orderBy: { createdAt: 'asc' } },
      sections: { orderBy: { orderIndex: 'asc' } },
      renderArtifacts: { orderBy: { version: 'desc' } },
      renderJobs: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!v) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(v);
});

router.delete('/:id', async (req, res) => {
  await prisma.video.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// 영상 업데이트 — 자막 스타일 override 등
const UpdateVideo = z.object({
  title: z.string().min(1).optional(),
  subtitleStyleOverride: z.record(z.unknown()).nullable().optional(),
});
router.patch('/:id', async (req, res) => {
  const parse = UpdateVideo.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body', issues: parse.error.issues });
    return;
  }
  const updated = await prisma.video.update({ where: { id: req.params.id }, data: parse.data });
  res.json(updated);
});

// ── 시나리오 생성 (Gemini + Claude hook) ──
const GenScenariosBody = z.object({ count: z.number().int().min(2).max(4).optional() });
router.post('/:id/scenarios', async (req, res) => {
  const parse = GenScenariosBody.safeParse(req.body ?? {});
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  try {
    const scenarios = await generateScenariosForVideo(req.params.id, parse.data.count ?? 3);
    res.json({ scenarios });
  } catch (err) {
    console.error('[scenarios] failed:', err);
    res.status(500).json({ error: 'generation_failed', message: (err as Error).message });
  }
});

// ── 시나리오 선택 → 섹션 분할 ──
const SelectScenarioBody = z.object({ scenarioId: z.string().uuid() });
router.post('/:id/select-scenario', async (req, res) => {
  const parse = SelectScenarioBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  try {
    const sections = await generateSectionsForVideo(req.params.id, parse.data.scenarioId);
    res.json({ sections });
  } catch (err) {
    console.error('[sections] failed:', err);
    res.status(500).json({ error: 'generation_failed', message: (err as Error).message });
  }
});

// ── 자산 업로드 완료 신호 (수동, 또는 자동 감지) ──
router.post('/:id/mark-ready', async (req, res) => {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { sections: true },
  });
  const allReady = video.sections.every((s) => s.sourceVideoPath && s.sourceAudioPath);
  if (!allReady) {
    res.status(400).json({ error: 'assets_incomplete' });
    return;
  }
  await prisma.video.update({
    where: { id: req.params.id },
    data: { status: VideoStatus.AWAITING_ASSETS },
  });
  res.json({ ok: true });
});

// ── BGM 업로드/삭제/스트림 ──
const bgmUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

router.post('/:id/bgm', bgmUpload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'file_required' });
    return;
  }
  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video) {
    res.status(404).json({ error: 'video_not_found' });
    return;
  }
  await fs.mkdir(videoWorkDir(video.id), { recursive: true });
  const ext = path.extname(req.file.originalname).slice(1).toLowerCase() || 'mp3';
  const destPath = videoBgmPath(video.id, ext);

  // 기존 BGM이 다른 확장자면 정리
  if (video.bgmPath && video.bgmPath !== destPath) {
    await fs.unlink(video.bgmPath).catch(() => {});
  }
  await fs.writeFile(destPath, req.file.buffer);
  await prisma.video.update({ where: { id: video.id }, data: { bgmPath: destPath } });

  res.json({ ok: true, path: destPath, fileName: req.file.originalname });
});

router.delete('/:id/bgm', async (req, res) => {
  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video) {
    res.status(404).json({ error: 'video_not_found' });
    return;
  }
  if (video.bgmPath) {
    await fs.unlink(video.bgmPath).catch(() => {});
  }
  await prisma.video.update({ where: { id: video.id }, data: { bgmPath: null } });
  res.json({ ok: true });
});

router.get('/:id/bgm', async (req, res) => {
  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video?.bgmPath || !fsSync.existsSync(video.bgmPath)) {
    res.status(404).json({ error: 'no_bgm' });
    return;
  }
  const ext = path.extname(video.bgmPath).toLowerCase();
  const mime: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.aac': 'audio/aac',
  };
  res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream');
  fsSync.createReadStream(video.bgmPath).pipe(res);
});

export default router;
