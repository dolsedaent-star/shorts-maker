'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { FONT_PRESETS, findPreset, previewFontStack } from '@/lib/fonts';

type StyleShape = {
  font?: string;
  highlight_color?: string;
  position_y_ratio?: number;
  [k: string]: unknown;
};

export function SubtitleStyleEditor({
  videoId,
  currentOverride,
  projectStyle,
  onChanged,
}: {
  videoId: string;
  currentOverride: StyleShape | null;
  projectStyle: StyleShape | null;
  onChanged: () => void;
}) {
  const effective: StyleShape = currentOverride ?? projectStyle ?? {};
  const currentFamily = (effective.font as string) ?? 'Pretendard ExtraBold';
  const preset = findPreset(currentFamily);

  const [selectedFamily, setSelectedFamily] = useState(currentFamily);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const dirty = selectedFamily !== currentFamily;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const newOverride = { ...effective, font: selectedFamily };
      await api(`/api/videos/${videoId}`, {
        method: 'PATCH',
        body: { subtitleStyleOverride: newOverride },
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-4 mb-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="text-sm font-semibold">
          🔤 자막 폰트{' '}
          <span className="text-[color:var(--color-text-dim)] font-normal">
            · {preset?.label ?? currentFamily}
          </span>
        </div>
        <span className="text-[color:var(--color-text-dim)] text-sm">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-2">
          {FONT_PRESETS.map((f) => {
            const isCurrent = f.family === currentFamily;
            const isSelected = f.family === selectedFamily;
            return (
              <label
                key={f.family}
                className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition ${
                  isSelected
                    ? 'border-[color:var(--color-accent-text)] bg-[color:var(--color-accent)]/10'
                    : 'border-[color:var(--color-border)] hover:border-[color:var(--color-text-dim)]'
                }`}
              >
                <input
                  type="radio"
                  name="font"
                  checked={isSelected}
                  onChange={() => setSelectedFamily(f.family)}
                  className="mt-1 accent-[color:var(--color-accent-text)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">{f.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                      {f.vibe}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] text-[color:var(--color-success)] font-semibold">
                        현재 사용 중
                      </span>
                    )}
                  </div>
                  <div
                    className="text-2xl leading-tight mt-1"
                    style={{ fontFamily: previewFontStack(f) }}
                  >
                    지금 다운받기 →
                  </div>
                  <div className="text-xs text-[color:var(--color-text-dim)] mt-0.5">
                    {f.hint}
                  </div>
                  <a
                    href={f.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] text-[color:var(--color-accent-text)] hover:underline mt-1 inline-block"
                  >
                    ⬇ 폰트 다운로드 (Windows 폰트 폴더에 설치 후 사용 가능)
                  </a>
                </div>
              </label>
            );
          })}

          <div className="flex justify-end gap-3 pt-2">
            {dirty && (
              <button
                type="button"
                onClick={() => setSelectedFamily(currentFamily)}
                className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
              >
                되돌리기
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || busy}
              className="bg-[color:var(--color-accent)] text-black font-semibold text-sm px-4 py-1.5 rounded disabled:opacity-30"
            >
              {busy ? '저장 중...' : '저장 (다음 렌더링부터 적용)'}
            </button>
          </div>
          {error && <div className="text-[color:var(--color-danger)] text-xs">{error}</div>}
          <p className="text-[11px] text-[color:var(--color-text-dim)] leading-relaxed">
            💡 폰트는 <strong>Windows에 미리 설치되어 있어야</strong> 영상에 적용됩니다. 다운로드 → TTF 파일 더블클릭 →
            "설치" 클릭. 적용은 다음 렌더링부터.
          </p>
        </div>
      )}
    </div>
  );
}
