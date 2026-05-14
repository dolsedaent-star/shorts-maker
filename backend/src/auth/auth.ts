/**
 * 단일 사용자 인증. 환경변수의 비밀번호를 상수 시간 비교로 검증하고,
 * 검증 성공 시 SECRET 기반 결정적 토큰을 발급한다.
 */
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

const SESSION_TOKEN = crypto
  .createHmac('sha256', env.SESSION_SECRET)
  .update('vibe-video-session-v1')
  .digest('hex');

export function verifyPassword(input: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(env.AUTH_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getSessionToken(): string {
  return SESSION_TOKEN;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('Authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  // 헤더 우선, 없으면 쿼리스트링 ?token= (img/video 등 <img src=> 직접 호출 케이스)
  const provided = m?.[1] ?? (typeof req.query.token === 'string' ? req.query.token : null);
  if (!provided) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(SESSION_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }
  next();
}
