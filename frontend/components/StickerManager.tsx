'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  POSITION_LABEL,
  POSITION_ORDER,
  SCALE_LABEL,
  type Sticker,
  type StickerPosition,
  type StickerScale,
} from '@/lib/types';

export function StickerManager({
  videoId,
  videoDuration,
}: {
  videoId: string;
  videoDuration: number;
}) {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const token = getToken();

  async function load() {
    try {
      const list = await api<Sticker[]>(`/api/stickers/videos/${videoId}`);
      setStickers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [videoId]);

  async function remove(id: string) {
    if (!confirm('삭제하시겠어요?')) return;
    await api(`/api/stickers/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-4 mb-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="text-sm font-semibold">
          🎨 스티커{' '}
          <span className="text-[color:var(--color-text-dim)] font-normal">
            · {stickers.length}개
          </span>
        </div>
        <span className="text-[color:var(--color-text-dim)] text-sm">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {loading && <div className="text-xs text-[color:var(--color-text-dim)]">불러오는 중...</div>}

          {stickers.length === 0 && !loading && (
            <div className="text-xs text-[color:var(--color-text-dim)]">
              아직 스티커가 없습니다. 아래 "+ 추가"로 PNG 업로드하세요.
            </div>
          )}

          {stickers.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 bg-[color:var(--color-surface-2)] rounded p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${apiBase}/api/stickers/${s.id}/image?token=${token}`}
                alt={s.originalName}
                className="w-12 h-12 object-contain bg-[color:var(--color-bg)] rounded"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.originalName}</div>
                <div className="text-xs text-[color:var(--color-text-dim)]">
                  {POSITION_LABEL[s.position]} · {SCALE_LABEL[s.scale]} · {s.startSec}s ~ {s.endSec}s
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(s.id)}
                className="text-xs text-[color:var(--color-danger)] hover:underline shrink-0"
              >
                삭제
              </button>
            </div>
          ))}

          {showAdd ? (
            <AddStickerForm
              videoId={videoId}
              videoDuration={videoDuration}
              onDone={() => {
                setShowAdd(false);
                load();
              }}
              onCancel={() => setShowAdd(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="w-full text-sm border-2 border-dashed border-[color:var(--color-border)] hover:border-[color:var(--color-text-dim)] rounded p-3 text-[color:var(--color-text-dim)]"
            >
              + 스티커 추가
            </button>
          )}

          {error && <div className="text-[color:var(--color-danger)] text-xs">{error}</div>}

          <p className="text-[11px] text-[color:var(--color-text-dim)] leading-relaxed">
            💡 PNG (투명 배경 권장). 위치는 9그리드, 크기 3단계. 표시 시간 범위 지정 가능.
          </p>
        </div>
      )}
    </div>
  );
}

function AddStickerForm({
  videoId,
  videoDuration,
  onDone,
  onCancel,
}: {
  videoId: string;
  videoDuration: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<StickerPosition>('BOTTOM_CENTER');
  const [scale, setScale] = useState<StickerScale>('MEDIUM');
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(Math.min(3, videoDuration));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('PNG 파일을 선택하세요');
      return;
    }
    if (endSec <= startSec) {
      setError('끝 시간이 시작 시간보다 커야 합니다');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('position', position);
      fd.append('scale', scale);
      fd.append('startSec', String(startSec));
      fd.append('endSec', String(endSec));
      await api(`/api/stickers/videos/${videoId}`, {
        method: 'POST',
        body: fd,
        raw: true,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded p-3 space-y-3"
    >
      {/* 파일 */}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full text-xs bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded p-2 text-left"
        >
          {file ? `📎 ${file.name}` : 'PNG/WebP 파일 선택...'}
        </button>
      </div>

      {/* 위치 (3x3 그리드) */}
      <div>
        <label className="text-xs text-[color:var(--color-text-dim)] mb-1.5 block">위치</label>
        <div className="grid grid-cols-3 gap-1 aspect-[9/16] max-w-[120px]">
          {POSITION_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPosition(p)}
              className={`border rounded text-lg leading-none flex items-center justify-center ${
                position === p
                  ? 'bg-[color:var(--color-accent)] border-[color:var(--color-accent)] text-black'
                  : 'border-[color:var(--color-border)] hover:border-[color:var(--color-text-dim)]'
              }`}
            >
              {POSITION_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* 크기 */}
      <div>
        <label className="text-xs text-[color:var(--color-text-dim)] mb-1 block">크기</label>
        <select
          value={scale}
          onChange={(e) => setScale(e.target.value as StickerScale)}
          className="w-full text-sm bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-2 py-1.5"
        >
          {(Object.keys(SCALE_LABEL) as StickerScale[]).map((s) => (
            <option key={s} value={s}>
              {SCALE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* 시간 범위 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[color:var(--color-text-dim)] mb-1 block">시작 (초)</label>
          <input
            type="number"
            min={0}
            max={videoDuration}
            step={0.1}
            value={startSec}
            onChange={(e) => setStartSec(parseFloat(e.target.value) || 0)}
            className="w-full text-sm bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-2 py-1.5"
          />
        </div>
        <div>
          <label className="text-xs text-[color:var(--color-text-dim)] mb-1 block">끝 (초)</label>
          <input
            type="number"
            min={0}
            max={videoDuration}
            step={0.1}
            value={endSec}
            onChange={(e) => setEndSec(parseFloat(e.target.value) || 0)}
            className="w-full text-sm bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-2 py-1.5"
          />
        </div>
      </div>

      {error && <div className="text-[color:var(--color-danger)] text-xs">{error}</div>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] px-2"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={busy || !file}
          className="bg-[color:var(--color-accent)] text-black text-sm font-semibold px-4 py-1.5 rounded disabled:opacity-30"
        >
          {busy ? '업로드 중...' : '추가'}
        </button>
      </div>
    </form>
  );
}
