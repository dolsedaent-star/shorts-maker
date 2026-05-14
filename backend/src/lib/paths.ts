/**
 * OneDrive 네트워크 폴더(STORAGE_BASE_PATH) 하위의 파일 경로 관리.
 *
 * 구조:
 *   {BASE}/
 *     videos/{videoId}/
 *       sections/{sectionId}.video.{ext}   -- 사용자 업로드 원본 영상
 *       sections/{sectionId}.audio.{ext}   -- 사용자 업로드 음성
 *       processed/{sectionId}.mp4          -- 9:16 정규화 캐시
 *       renders/final-v{n}.mp4             -- 버전별 최종 영상
 *       renders/thumb-v{n}.jpg
 *     tmp/                                 -- 작업 임시 파일
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../config/env.js';

const BASE = env.STORAGE_BASE_PATH;

export function videoWorkDir(videoId: string): string {
  return path.join(BASE, 'videos', videoId);
}

export type SectionAssetKind = 'video' | 'audio' | 'image';

export function sectionUploadPath(
  videoId: string,
  sectionId: string,
  kind: SectionAssetKind,
  ext: string
): string {
  return path.join(videoWorkDir(videoId), 'sections', `${sectionId}.${kind}.${ext}`);
}

export function sectionProcessedPath(videoId: string, sectionId: string): string {
  return path.join(videoWorkDir(videoId), 'processed', `${sectionId}.mp4`);
}

export function renderArtifactPath(videoId: string, version: number): string {
  return path.join(videoWorkDir(videoId), 'renders', `final-v${version}.mp4`);
}

export function thumbnailPath(videoId: string, version: number): string {
  return path.join(videoWorkDir(videoId), 'renders', `thumb-v${version}.jpg`);
}

export function videoBgmPath(videoId: string, ext: string): string {
  return path.join(videoWorkDir(videoId), `bgm.${ext}`);
}

export function stickerImagePath(videoId: string, stickerId: string, ext: string): string {
  return path.join(videoWorkDir(videoId), 'stickers', `${stickerId}.${ext}`);
}

export async function ensureStickerDir(videoId: string): Promise<string> {
  const dir = path.join(videoWorkDir(videoId), 'stickers');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureSectionDir(videoId: string): Promise<string> {
  const dir = path.join(videoWorkDir(videoId), 'sections');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureRenderDir(videoId: string): Promise<string> {
  const renders = path.join(videoWorkDir(videoId), 'renders');
  const processed = path.join(videoWorkDir(videoId), 'processed');
  await fs.mkdir(renders, { recursive: true });
  await fs.mkdir(processed, { recursive: true });
  return renders;
}

export async function ensureTmpDir(): Promise<string> {
  const dir = path.join(BASE, 'tmp');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
