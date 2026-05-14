'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';

export function BgmUpload({
  videoId,
  hasBgm,
  onChanged,
}: {
  videoId: string;
  hasBgm: boolean;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const token = getToken();

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api(`/api/videos/${videoId}/bgm`, {
        method: 'POST',
        body: fd,
        raw: true,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('BGM을 제거하시겠어요?')) return;
    setBusy(true);
    try {
      await api(`/api/videos/${videoId}/bgm`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">
          🎵 배경음악 (BGM){' '}
          <span className="text-[color:var(--color-text-dim)] font-normal text-xs">
            · 선택 사항
          </span>
        </div>
        {hasBgm && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-xs text-[color:var(--color-danger)] hover:underline"
          >
            제거
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />

      {hasBgm ? (
        <div className="space-y-2">
          <audio
            controls
            src={`${apiBase}/api/videos/${videoId}/bgm?token=${token}`}
            className="w-full"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
          >
            {busy ? '교체 중...' : '다른 파일로 교체'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          disabled={busy}
          className="w-full border-2 border-dashed border-[color:var(--color-border)] hover:border-[color:var(--color-text-dim)] rounded p-4 text-sm text-[color:var(--color-text-dim)] transition disabled:opacity-50"
        >
          {busy ? '업로드 중...' : 'BGM 파일 업로드 / 드래그 (mp3, m4a, wav 등)'}
        </button>
      )}

      <p className="text-[11px] text-[color:var(--color-text-dim)] mt-2 leading-relaxed">
        💡 영상 길이에 맞춰 자동으로 잘림 · 마지막 1.5초 페이드아웃 · 대사 나올 때 자동으로 볼륨 다운(사이드체인 더킹)
      </p>

      {error && <div className="text-[color:var(--color-danger)] text-xs mt-2">{error}</div>}
    </div>
  );
}
