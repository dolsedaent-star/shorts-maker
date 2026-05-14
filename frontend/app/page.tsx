'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';

export default function HomePage() {
  return (
    <AuthGate>
      <ProjectList />
    </AuthGate>
  );
}

function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Project[]>('/api/projects')
      .then(setProjects)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Vibe Video</h1>
          <p className="text-[color:var(--color-text-dim)] mt-1">마케팅 쇼츠 양산</p>
        </div>
        <Link
          href="/projects/new"
          className="bg-[color:var(--color-accent)] text-black font-semibold px-5 py-2.5 rounded hover:brightness-110"
        >
          + 새 프로젝트
        </Link>
      </header>

      {error && <div className="text-[color:var(--color-danger)] mb-4">{error}</div>}

      {projects === null ? (
        <div className="text-[color:var(--color-text-dim)]">불러오는 중...</div>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-[color:var(--color-border)] rounded-lg p-12 text-center text-[color:var(--color-text-dim)]">
          아직 프로젝트가 없습니다. + 새 프로젝트 버튼으로 시작하세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 hover:border-[color:var(--color-accent)] transition"
            >
              <div className="text-lg font-semibold mb-1 truncate">{p.name}</div>
              <div className="text-sm text-[color:var(--color-text-dim)] mb-3 truncate">
                {p.appName}
              </div>
              <div className="flex justify-between text-xs text-[color:var(--color-text-dim)]">
                <span>영상 {p._count?.videos ?? 0}개</span>
                <span>{new Date(p.updatedAt).toLocaleDateString('ko-KR')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
