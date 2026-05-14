'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { TONE_LABEL, VIDEO_STATUS_LABEL, type Project } from '@/lib/types';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <ProjectDetail id={id} />
    </AuthGate>
  );
}

function ProjectDetail({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = getToken();

  useEffect(() => {
    api<Project>(`/api/projects/${id}`).then(setProject).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="p-8 text-[color:var(--color-danger)]">{error}</div>;
  if (!project) return <div className="p-8 text-[color:var(--color-text-dim)]">불러오는 중...</div>;

  return (
    <main className="max-w-5xl mx-auto p-8">
      <Link href="/" className="text-sm text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]">
        ← 프로젝트 목록
      </Link>

      <header className="mt-3 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold truncate">{project.name}</h1>
            <div className="text-[color:var(--color-text-dim)] mt-1 text-sm">
              {project.appName} · {TONE_LABEL[project.tone]} · 기본 {project.defaultDurationS}초
            </div>
            <p className="mt-3 text-sm text-[color:var(--color-text-dim)] line-clamp-2">
              {project.description}
            </p>
          </div>
          <Link
            href={`/projects/${project.id}/videos/new`}
            className="shrink-0 bg-[color:var(--color-accent)] text-black font-semibold px-5 py-2.5 rounded hover:brightness-110"
          >
            + 새 영상
          </Link>
        </div>
      </header>

      <h2 className="text-lg font-semibold mb-3">영상 ({project.videos?.length ?? 0})</h2>
      {!project.videos?.length ? (
        <div className="border border-dashed border-[color:var(--color-border)] rounded-lg p-12 text-center text-[color:var(--color-text-dim)]">
          영상이 없습니다. + 새 영상 으로 시작하세요.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {project.videos.map((v) => {
            const latest = v.renderArtifacts?.[0];
            const thumbUrl = v.thumbnailPath
              ? `${process.env.NEXT_PUBLIC_API_URL}/api/renders/videos/${v.id}/thumbnail?token=${token}`
              : null;
            return (
              <Link
                key={v.id}
                href={`/videos/${v.id}`}
                className="block bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg overflow-hidden hover:border-[color:var(--color-accent)] transition"
              >
                <div className="aspect-[9/16] bg-[color:var(--color-surface-2)] flex items-center justify-center">
                  {thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[color:var(--color-text-dim)] text-xs">썸네일 없음</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium truncate">{v.title}</div>
                  <div className="text-xs text-[color:var(--color-text-dim)] mt-1 flex items-center justify-between">
                    <span>{VIDEO_STATUS_LABEL[v.status]}</span>
                    {latest && <span>v{latest.version}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
