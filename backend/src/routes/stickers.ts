import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { StickerPosition, StickerScale } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../auth/auth.js';
import { ensureStickerDir, stickerImagePath } from '../lib/paths.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const CreateSticker = z.object({
  position: z.nativeEnum(StickerPosition).optional(),
  scale: z.nativeEnum(StickerScale).optional(),
  startSec: z.coerce.number().min(0),
  endSec: z.coerce.number().min(0),
});

router.post('/videos/:videoId', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'file_required' });
    return;
  }
  const parse = CreateSticker.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body', issues: parse.error.issues });
    return;
  }
  const video = await prisma.video.findUnique({ where: { id: req.params.videoId } });
  if (!video) {
    res.status(404).json({ error: 'video_not_found' });
    return;
  }

  await ensureStickerDir(video.id);
  const ext = path.extname(req.file.originalname).slice(1).toLowerCase() || 'png';

  const sticker = await prisma.sticker.create({
    data: {
      videoId: video.id,
      imagePath: '', // 임시. 아래에서 id 알고 나서 채움
      originalName: req.file.originalname,
      position: parse.data.position ?? 'BOTTOM_CENTER',
      scale: parse.data.scale ?? 'MEDIUM',
      startSec: parse.data.startSec,
      endSec: parse.data.endSec,
    },
  });
  const destPath = stickerImagePath(video.id, sticker.id, ext);
  await fs.writeFile(destPath, req.file.buffer);
  const updated = await prisma.sticker.update({
    where: { id: sticker.id },
    data: { imagePath: destPath },
  });

  res.status(201).json(updated);
});

router.get('/videos/:videoId', async (req, res) => {
  const list = await prisma.sticker.findMany({
    where: { videoId: req.params.videoId },
    orderBy: { startSec: 'asc' },
  });
  res.json(list);
});

const UpdateSticker = z.object({
  position: z.nativeEnum(StickerPosition).optional(),
  scale: z.nativeEnum(StickerScale).optional(),
  startSec: z.coerce.number().min(0).optional(),
  endSec: z.coerce.number().min(0).optional(),
});
router.patch('/:id', async (req, res) => {
  const parse = UpdateSticker.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body', issues: parse.error.issues });
    return;
  }
  const updated = await prisma.sticker.update({ where: { id: req.params.id }, data: parse.data });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const s = await prisma.sticker.findUnique({ where: { id: req.params.id } });
  if (!s) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  if (s.imagePath) await fs.unlink(s.imagePath).catch(() => {});
  await prisma.sticker.delete({ where: { id: s.id } });
  res.status(204).end();
});

router.get('/:id/image', async (req, res) => {
  const s = await prisma.sticker.findUnique({ where: { id: req.params.id } });
  if (!s?.imagePath || !fsSync.existsSync(s.imagePath)) {
    res.status(404).json({ error: 'no_image' });
    return;
  }
  const ext = path.extname(s.imagePath).toLowerCase();
  const mime: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  res.setHeader('Content-Type', mime[ext] ?? 'application/octet-stream');
  fsSync.createReadStream(s.imagePath).pipe(res);
});

export default router;
