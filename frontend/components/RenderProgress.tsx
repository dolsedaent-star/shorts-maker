'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { RenderJob } from '@/lib/types';

export function RenderProgress({
  jobId,
  onDone,
  onFailed,
}: {
  jobId: string;
  onDone: () => void;
  onFailed: () => void;
}) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const j = await api<RenderJob>(`/api/renders/jobs/${jobId}`);
        if (cancelled) return;
        setJob(j);
        if (j.status === 'SUCCEEDED') {
          onDone();
          return;
        }
        if (j.status === 'FAILED') {
          onFailed();
          return;
        }
        timer = setTimeout(poll, 2000);
      } catch {
        timer = setTimeout(poll, 5000);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, onDone, onFailed]);

  // 1초마다 시계 갱신 (elapsed/ETA 라이브 업데이트)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!job) return <div className="text-[color:var(--color-text-dim)] text-sm">대기 중...</div>;

  const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;
  // ETA: 진행률 5% 이상 + 처리 중일 때만 의미 있음
  const etaMs =
    startedAt && job.progressPct >= 5 && job.progressPct < 100 && job.status === 'PROCESSING'
      ? (elapsedMs / job.progressPct) * (100 - job.progressPct)
      : null;

  return (
    <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">{job.currentStep ?? '준비 중'}</div>
        <div className="text-sm text-[color:var(--color-text-dim)] tabular-nums">
          {job.progressPct}%
        </div>
      </div>
      <div className="w-full h-2 bg-[color:var(--color-surface-2)] rounded overflow-hidden">
        <div
          className="h-full bg-[color:var(--color-accent)] transition-all duration-300"
          style={{ width: `${job.progressPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-[color:var(--color-text-dim)] tabular-nums">
        <span>
          {startedAt ? `경과 ${fmt(elapsedMs)}` : '대기열에서 시작 대기 중...'}
        </span>
        <span>{etaMs !== null ? `약 ${fmt(etaMs)} 남음 (추정)` : ''}</span>
      </div>
      {job.status === 'FAILED' && job.errorMessage && (
        <div className="text-[color:var(--color-danger)] text-xs mt-3 whitespace-pre-wrap">
          {job.errorMessage}
        </div>
      )}
    </div>
  );
}

function fmt(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
