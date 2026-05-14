import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const env = {
  AUTH_PASSWORD: required('AUTH_PASSWORD'),
  SESSION_SECRET: required('SESSION_SECRET'),

  DATABASE_URL: required('DATABASE_URL'),

  GEMINI_API_KEY: required('GEMINI_API_KEY'),
  ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),

  GEMINI_MODEL_PRO: process.env.GEMINI_MODEL_PRO || 'gemini-2.5-pro',
  GEMINI_MODEL_FLASH: process.env.GEMINI_MODEL_FLASH || 'gemini-2.5-flash',
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',

  STORAGE_BASE_PATH: required('STORAGE_BASE_PATH'),

  FFMPEG_PATH: process.env.FFMPEG_PATH || '',
  FFPROBE_PATH: process.env.FFPROBE_PATH || '',

  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const;
