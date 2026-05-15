'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { previewFontStack } from '@/lib/fonts';
import type { Video } from '@/lib/types';

type Props = {
  video: Video;
  onChanged: () => void;
};

const MAX_LEN = 12;

export function TopTextEditor({ video, onChanged }: Props) {
  const [line1, setLine1] = useState(video.topTextLine1 ?? '');
  const [line2, setLine2] = useState(video.topTextLine2 ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLine1(video.topTextLine1 ?? '');
    setLine2(video.topTextLine2 ?? '');
  }, [video.topTextLine1, video.topTextLine2]);

  const dirty = line1 !== (video.topTextLine1 ?? '') || line2 !== (video.topTextLine2 ?? '');

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api(`/api/videos/${video.id}`, {
        method: 'PATCH',
        body: {
          topTextLine1: line1.trim() || null,
          topTextLine2: line2.trim() || null,
        },
      });
      onChanged();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-[color:var(--color-border)] rounded-lg p-4 bg-[color:var(--color-surface)] mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-sm">상단 텍스트 (Type 2)</h3>
        <span className="text-xs text-[color:var(--color-text-dim)]">
          검정 띠에 영상 전체 길이 동안 고정 표시
        </span>
      </div>

      <div className="flex gap-4">
        {/* 미리보기 */}
        <div
          className="w-32 aspect-[9/16] rounded overflow-hidden flex-shrink-0 flex flex-col"
          style={{ background: '#000' }}
        >
          <div
            className="flex flex-col items-center justify-center text-center px-2"
            style={{ height: '22%', gap: '4px', fontFamily: previewFontStack('Do Hyeon') }}
          >
            <div
              className="leading-tight"
              style={{ color: '#FFD000', fontSize: '13px', fontWeight: 900 }}
            >
              {line1 || <span style={{ opacity: 0.3 }}>line 1</span>}
            </div>
            <div
              className="leading-tight"
              style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 900 }}
            >
              {line2 || <span style={{ opacity: 0.3 }}>line 2</span>}
            </div>
          </div>
          <div className="flex-1 bg-neutral-700 flex items-center justify-center text-[10px] text-neutral-400">
            (영상)
          </div>
        </div>

        {/* 편집 */}
        <div className="flex-1 space-y-2">
          <label className="block">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-[color:var(--color-text-dim)]">line 1 (강조)</span>
              <span
                className={`text-xs ${
                  line1.length > MAX_LEN
                    ? 'text-[color:var(--color-danger)]'
                    : 'text-[color:var(--color-text-dim)]'
                }`}
              >
                {line1.length}/{MAX_LEN}
              </span>
            </div>
            <input
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              maxLength={MAX_LEN + 2}
              placeholder="예: 월 100만원 버는"
              className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-2.5 py-1.5 text-sm outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>
          <label className="block">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-[color:var(--color-text-dim)]">line 2 (주제)</span>
              <span
                className={`text-xs ${
                  line2.length > MAX_LEN
                    ? 'text-[color:var(--color-danger)]'
                    : 'text-[color:var(--color-text-dim)]'
                }`}
              >
                {line2.length}/{MAX_LEN}
              </span>
            </div>
            <input
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              maxLength={MAX_LEN + 2}
              placeholder="예: AI 부업"
              className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-2.5 py-1.5 text-sm outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving || line1.length > MAX_LEN || line2.length > MAX_LEN}
              className="bg-[color:var(--color-accent)] text-black text-sm font-semibold px-3 py-1.5 rounded disabled:opacity-30"
            >
              {saving ? '저장중...' : '저장'}
            </button>
            {saved && (
              <span className="text-xs text-[color:var(--color-accent-text)]">✓ 저장됨</span>
            )}
            {error && (
              <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
