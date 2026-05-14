import { Router } from 'express';
import { z } from 'zod';
import { Tone } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../auth/auth.js';
import { DEFAULT_SUBTITLE_STYLE } from '../lib/subtitleStyle.js';

const router = Router();
router.use(requireAuth);

const CreateProject = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  appName: z.string().min(1),
  targetUser: z.string().min(1),
  valueProposition: z.string().min(1),
  storeUrl: z.string().url().optional(),
  tone: z.nativeEnum(Tone),
  defaultDurationS: z.number().int().min(5).max(60).optional(),
  subtitleStyle: z.record(z.unknown()).optional(),
});

router.post('/', async (req, res) => {
  const parse = CreateProject.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body', issues: parse.error.issues });
    return;
  }
  const p = await prisma.project.create({
    data: {
      ...parse.data,
      subtitleStyle: parse.data.subtitleStyle ?? DEFAULT_SUBTITLE_STYLE,
    },
  });
  res.status(201).json(p);
});

router.get('/', async (_req, res) => {
  const list = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { videos: true } } },
  });
  res.json(list);
});

router.get('/:id', async (req, res) => {
  const p = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      videos: {
        orderBy: { createdAt: 'desc' },
        include: {
          renderArtifacts: { orderBy: { version: 'desc' }, take: 1 },
        },
      },
    },
  });
  if (!p) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(p);
});

const UpdateProject = CreateProject.partial();
router.patch('/:id', async (req, res) => {
  const parse = UpdateProject.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body', issues: parse.error.issues });
    return;
  }
  const p = await prisma.project.update({ where: { id: req.params.id }, data: parse.data });
  res.json(p);
});

router.delete('/:id', async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
