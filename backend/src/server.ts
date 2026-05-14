import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import videosRouter from './routes/videos.js';
import sectionsRouter from './routes/sections.js';
import rendersRouter from './routes/renders.js';
import stickersRouter from './routes/stickers.js';

// Prisma BigInt → JSON 직렬화 패치 (RenderArtifact.fileSizeBytes 등)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV });
});

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/videos', videosRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/renders', rendersRouter);
app.use('/api/stickers', stickersRouter);

// 글로벌 에러 핸들러
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal_error', message: err.message });
});

app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
  console.log(`[api] storage: ${env.STORAGE_BASE_PATH}`);
});
