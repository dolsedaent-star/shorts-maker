import { Router } from 'express';
import { z } from 'zod';
import { getSessionToken, requireAuth, verifyPassword } from '../auth/auth.js';

const router = Router();

const LoginBody = z.object({ password: z.string().min(1) });

router.post('/login', (req, res) => {
  const parse = LoginBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  if (!verifyPassword(parse.data.password)) {
    res.status(401).json({ error: 'invalid_password' });
    return;
  }
  res.json({ token: getSessionToken() });
});

router.get('/check', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

export default router;
