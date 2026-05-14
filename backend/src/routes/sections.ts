import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { TrimField, VideoStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../auth/auth.js';
import { ensureSectionDir, sectionUploadPath } from '../lib/paths.js';
import {
  backfillImagePromptForSection,
  manualEditSection,
  regenerateVideoPromptFromImage,
  trimSectionField,
} from '../services/llm/orchestrator.js';

const router = Router();
router.use(requireAuth);

// ── 섹션 단건 조회 ──
router.get('/:id', async (req, res) => {
  const s = await prisma.section.findUnique({
    where: { id: req.params.id },
    include: { trimHistory: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!s) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(s);
});

// ── 수동 편집 (LLM 호출 없음) ──
const ManualEditBody = z.object({
  field: z.nativeEnum(TrimField),
  newText: z.string().min(1),
});
router.patch('/:id', async (req, res) => {
  const parse = ManualEditBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  await manualEditSection(req.params.id, parse.data.field, parse.data.newText);
  const updated = await prisma.section.findUnique({ where: { id: req.params.id } });
  res.json(updated);
});

// ── Trim (LLM 호출) ──
const TrimBody = z.object({
  field: z.nativeEnum(TrimField),
  userInstruction: z.string().min(1).max(500),
});
router.post('/:id/trim', async (req, res) => {
  const parse = TrimBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  try {
    const result = await trimSectionField(
      req.params.id,
      parse.data.field,
      parse.data.userInstruction
    );
    res.json(result);
  } catch (err) {
    console.error('[trim] failed:', err);
    res.status(500).json({ error: 'trim_failed', message: (err as Error).message });
  }
});

// ── Trim 이력 조회 ──
router.get('/:id/history', async (req, res) => {
  const list = await prisma.trimHistory.findMany({
    where: { sectionId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(list);
});

// ── 영상/음성 업로드 (multer) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

const UploadQuery = z.object({ kind: z.enum(['video', 'audio', 'image']) });

function defaultExt(kind: 'video' | 'audio' | 'image'): string {
  if (kind === 'video') return 'mp4';
  if (kind === 'audio') return 'm4a';
  return 'png';
}

function fieldForKind(kind: 'video' | 'audio' | 'image') {
  if (kind === 'video') return 'sourceVideoPath' as const;
  if (kind === 'audio') return 'sourceAudioPath' as const;
  return 'sourceImagePath' as const;
}

router.post('/:id/upload', upload.single('file'), async (req, res) => {
  const parsedQ = UploadQuery.safeParse(req.query);
  if (!parsedQ.success) {
    res.status(400).json({ error: 'kind_required' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'file_required' });
    return;
  }

  const section = await prisma.section.findUnique({ where: { id: req.params.id } });
  if (!section) {
    res.status(404).json({ error: 'section_not_found' });
    return;
  }

  await ensureSectionDir(section.videoId);
  const ext =
    path.extname(req.file.originalname).slice(1).toLowerCase() ||
    defaultExt(parsedQ.data.kind);
  const destPath = sectionUploadPath(section.videoId, section.id, parsedQ.data.kind, ext);
  await fs.writeFile(destPath, req.file.buffer);

  await prisma.section.update({
    where: { id: section.id },
    data: { [fieldForKind(parsedQ.data.kind)]: destPath },
  });

  // 모든 섹션의 video+audio 업로드 완료 시 자동 AWAITING_ASSETS (image는 렌더에 직접 안 쓰임)
  if (parsedQ.data.kind !== 'image') {
    const all = await prisma.section.findMany({ where: { videoId: section.videoId } });
    const allReady = all.every((s) => s.sourceVideoPath && s.sourceAudioPath);
    if (allReady) {
      await prisma.video.update({
        where: { id: section.videoId },
        data: { status: VideoStatus.AWAITING_ASSETS },
      });
    }
  }

  res.json({ ok: true, kind: parsedQ.data.kind, path: destPath });
});

router.delete('/:id/asset', async (req, res) => {
  const parsedQ = UploadQuery.safeParse(req.query);
  if (!parsedQ.success) {
    res.status(400).json({ error: 'kind_required' });
    return;
  }
  const section = await prisma.section.findUnique({ where: { id: req.params.id } });
  if (!section) {
    res.status(404).json({ error: 'section_not_found' });
    return;
  }
  const field = fieldForKind(parsedQ.data.kind);
  const current = section[field];
  if (current) {
    await fs.unlink(current).catch(() => {});
  }
  await prisma.section.update({ where: { id: section.id }, data: { [field]: null } });
  res.json({ ok: true });
});

// ── 콘티 이미지 스트리밍 (썸네일 표시용) ──
router.get('/:id/image', async (req, res) => {
  const section = await prisma.section.findUnique({ where: { id: req.params.id } });
  if (!section?.sourceImagePath || !fsSync.existsSync(section.sourceImagePath)) {
    res.status(404).json({ error: 'no_image' });
    return;
  }
  const ext = path.extname(section.sourceImagePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  res.setHeader('Content-Type', mimeMap[ext] ?? 'application/octet-stream');
  fsSync.createReadStream(section.sourceImagePath).pipe(res);
});

// ── 이미지 기반 video_prompt 재생성 ──
router.post('/:id/regenerate-video-prompt', async (req, res) => {
  try {
    const result = await regenerateVideoPromptFromImage(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'regen_failed', message: (err as Error).message });
  }
});

// ── 빈 image_prompt backfill (기존 영상용) ──
router.post('/:id/generate-image-prompt', async (req, res) => {
  try {
    const imagePrompt = await backfillImagePromptForSection(req.params.id);
    res.json({ imagePrompt });
  } catch (err) {
    res.status(500).json({ error: 'gen_failed', message: (err as Error).message });
  }
});

export default router;
