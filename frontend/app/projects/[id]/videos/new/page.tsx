'use client';

import { FormEvent, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { api } from '@/lib/api';
import type { Project, Video, VideoFormat } from '@/lib/types';
import { VIDEO_FORMAT_DESC, VIDEO_FORMAT_LABEL } from '@/lib/types';

export default function NewVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <NewVideoForm projectId={id} />
    </AuthGate>
  );
}

function NewVideoForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(18);
  const [format, setFormat] = useState<VideoFormat>('TOP_TEXT_BAND');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Project>(`/api/projects/${projectId}`).then((p) => {
      setProject(p);
      setDuration(p.defaultDurationS);
    });
  }, [projectId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const created = await api<Video>('/api/videos', {
        body: { projectId, title, durationSeconds: duration, format },
      });
      router.replace(`/videos/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto p-8">
      <Link
        href={`/projects/${projectId}`}
        className="text-sm text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
      >
        ← {project?.name ?? '프로젝트'}
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">새 영상</h1>

      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block">
          <span className="text-sm text-[color:var(--color-text-dim)] block mb-1.5">영상 제목</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-3 py-2 outline-none focus:border-[color:var(--color-accent)]"
            placeholder="예: 첫 출시 알림"
          />
        </label>

        <div>
          <span className="text-sm text-[color:var(--color-text-dim)] block mb-1.5">영상 포맷</span>
          <div className="grid grid-cols-1 gap-2">
            {(['TOP_TEXT_BAND', 'FULLSCREEN_OVERLAY'] as VideoFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`text-left px-3 py-2.5 rounded border transition ${
                  format === f
                    ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10'
                    : 'border-[color:var(--color-border)] hover:border-[color:var(--color-text-dim)]'
                }`}
              >
                <div className="font-medium text-sm">{VIDEO_FORMAT_LABEL[f]}</div>
                <div className="text-xs text-[color:var(--color-text-dim)] mt-0.5">
                  {VIDEO_FORMAT_DESC[f]}
                </div>
              </button>
            ))}
          </div>
          <div className="text-xs text-[color:var(--color-text-dim)] mt-1.5">
            상단 텍스트는 시나리오 분할 시 AI가 같이 생성하고, 이후 직접 편집 가능합니다.
          </div>
        </div>

        <label className="block">
          <span className="text-sm text-[color:var(--color-text-dim)] block mb-1.5">
            길이 ({duration}초) — 권장 15-20초
          </span>
          <input
            type="range"
            min={10}
            max={40}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full accent-[color:var(--color-accent)]"
          />
          <div className="flex justify-between text-xs text-[color:var(--color-text-dim)] mt-1">
            <span>10s</span>
            <span>20s</span>
            <span>30s</span>
            <span>40s</span>
          </div>
        </label>

        {error && <div className="text-[color:var(--color-danger)] text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !title}
          className="w-full bg-[color:var(--color-accent)] text-black font-semibold py-3 rounded disabled:opacity-40 hover:brightness-110"
        >
          {loading ? '생성 중...' : '영상 만들기 시작'}
        </button>
      </form>
    </main>
  );
}
