'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { Section } from '@/lib/types';

export function Storyboard({
  sections,
  onSectionClick,
  onChanged,
}: {
  sections: Section[];
  onSectionClick: (sectionId: string) => void;
  onChanged: () => void;
}) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const token = getToken();
  const totalImages = sections.filter((s) => s.sourceImagePath).length;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const modalInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleUpload(sectionId: string, file: File) {
    setBusyId(sectionId);
    try {
      await uploadFile(sectionId, 'image', file);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-4 mb-5">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm font-semibold">
          콘티{' '}
          <span className="text-[color:var(--color-text-dim)] font-normal">
            · {totalImages}/{sections.length} 이미지 업로드됨
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs font-semibold text-[color:var(--color-accent-text)] hover:underline"
          >
            🔍 확대보기
          </button>
          <span className="text-xs text-[color:var(--color-text-dim)]">
            썸네일 클릭 → 업로드 · ⋯ → 섹션 펼침
          </span>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {sections.map((s, idx) => {
          const has = !!s.sourceImagePath;
          const isLast = idx === sections.length - 1;
          const isBusy = busyId === s.id;
          return (
            <div key={s.id} className="flex items-center shrink-0 gap-3">
              <div className="shrink-0">
                {/* 숨겨진 file input */}
                <input
                  ref={(el) => { inputRefs.current[s.id] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(s.id, f);
                  }}
                />
                {/* 썸네일 = 업로드 트리거 */}
                <button
                  type="button"
                  onClick={() => inputRefs.current[s.id]?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleUpload(s.id, f);
                  }}
                  disabled={isBusy}
                  className={`block w-28 aspect-[9/16] rounded overflow-hidden border-2 transition relative ${
                    has
                      ? 'border-[color:var(--color-success)]'
                      : 'border-dashed border-[color:var(--color-border)] hover:border-[color:var(--color-accent-text)]'
                  } ${isBusy ? 'opacity-50' : ''}`}
                  title={has ? '클릭하여 이미지 교체' : '클릭하여 이미지 업로드'}
                >
                  {has ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${apiBase}/api/sections/${s.id}/image?token=${token}`}
                      alt={`section ${s.orderIndex}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[color:var(--color-surface-2)] flex items-center justify-center text-[11px] text-[color:var(--color-text-dim)] text-center px-1">
                      {isBusy ? '업로드<br/>중...' : '+ 이미지'}
                    </div>
                  )}
                  {isBusy && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-xs text-white">
                      업로드 중
                    </div>
                  )}
                </button>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[color:var(--color-text-dim)] font-mono px-0.5">
                  <span>#{s.orderIndex} · {s.durationSeconds}s</span>
                  <button
                    type="button"
                    onClick={() => onSectionClick(s.id)}
                    className="hover:text-[color:var(--color-text)] px-1"
                    title="섹션 상세 펼치기"
                  >
                    ⋯
                  </button>
                </div>
              </div>
              {!isLast && (
                <div className="text-[color:var(--color-text-dim)] text-lg select-none">→</div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <StoryboardModal
          sections={sections}
          apiBase={apiBase ?? ''}
          token={token}
          onClose={() => setShowModal(false)}
          onUpload={handleUpload}
          busyId={busyId}
          inputRefs={modalInputRefs}
        />
      )}
    </div>
  );
}

// ─── Modal: 콘티 확대 뷰 ──────────────────────────────────────────

function StoryboardModal({
  sections,
  apiBase,
  token,
  onClose,
  onUpload,
  busyId,
  inputRefs,
}: {
  sections: Section[];
  apiBase: string;
  token: string | null;
  onClose: () => void;
  onUpload: (sectionId: string, file: File) => void;
  busyId: string | null;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}) {
  // ESC로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // 섹션 수에 따라 그리드 컬럼
  const cols =
    sections.length <= 3 ? 'md:grid-cols-3' :
    sections.length <= 4 ? 'md:grid-cols-4' :
    'md:grid-cols-5';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--color-surface)] rounded-lg w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--color-border)]">
          <div className="text-base font-semibold">
            콘티 확대보기 <span className="text-[color:var(--color-text-dim)] font-normal text-sm">· 총 {sections.length}컷</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] leading-none w-8 h-8 flex items-center justify-center"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 그리드 */}
        <div className="overflow-y-auto p-6">
          <div className={`grid grid-cols-2 ${cols} gap-5`}>
            {sections.map((s) => {
              const has = !!s.sourceImagePath;
              const isBusy = busyId === s.id;
              return (
                <div key={s.id} className="flex flex-col">
                  <input
                    ref={(el) => { inputRefs.current[s.id] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(s.id, f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => inputRefs.current[s.id]?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files?.[0];
                      if (f) onUpload(s.id, f);
                    }}
                    disabled={isBusy}
                    className={`block w-full aspect-[9/16] rounded-lg overflow-hidden border-2 transition relative ${
                      has
                        ? 'border-[color:var(--color-success)]'
                        : 'border-dashed border-[color:var(--color-border)] hover:border-[color:var(--color-accent-text)]'
                    } ${isBusy ? 'opacity-50' : ''}`}
                    title={has ? '클릭하여 이미지 교체' : '클릭하여 이미지 업로드'}
                  >
                    {has ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${apiBase}/api/sections/${s.id}/image?token=${token}`}
                        alt={`section ${s.orderIndex}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[color:var(--color-surface-2)] flex items-center justify-center text-sm text-[color:var(--color-text-dim)]">
                        + 이미지 업로드
                      </div>
                    )}
                    {isBusy && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                        업로드 중...
                      </div>
                    )}
                  </button>
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="font-mono text-[color:var(--color-text-dim)]">
                      #{s.orderIndex} · {s.durationSeconds}s
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--color-text)] line-clamp-3 leading-snug">
                    {s.scriptText}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-[color:var(--color-border)] text-xs text-[color:var(--color-text-dim)] flex justify-between">
          <span>ESC 또는 바깥 영역 클릭 → 닫기</span>
          <span>각 셀 클릭/드래그 → 이미지 업로드/교체</span>
        </div>
      </div>
    </div>
  );
}
