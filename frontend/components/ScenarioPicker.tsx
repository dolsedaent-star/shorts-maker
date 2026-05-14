'use client';

import { useState } from 'react';
import { ANGLE_LABEL, type Scenario } from '@/lib/types';

export function ScenarioPicker({
  scenarios,
  onSelect,
  busy,
}: {
  scenarios: Scenario[];
  onSelect: (id: string) => void;
  busy: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(scenarios[0]?.id ?? null);

  return (
    <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg divide-y divide-[color:var(--color-border)] overflow-hidden">
      {scenarios.map((s, idx) => {
        const isOpen = expandedId === s.id;
        return (
          <div key={s.id}>
            {/* 헤더 (항상 보임, 클릭해서 토글) */}
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : s.id)}
              className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[color:var(--color-surface-2)] transition"
            >
              <span className="text-[color:var(--color-text-dim)] text-sm w-5">
                {isOpen ? '▾' : '▸'}
              </span>
              <span className="text-[10px] font-mono text-[color:var(--color-text-dim)]">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-accent-text)] bg-[color:var(--color-accent)]/40 px-2 py-0.5 rounded">
                {ANGLE_LABEL[s.angle]}
              </span>
              <span className="flex-1 font-semibold truncate">
                "{s.hookLine}"
              </span>
            </button>

            {/* 본문 (펼침) */}
            {isOpen && (
              <div className="px-5 pb-5 pl-[60px]">
                <div className="text-sm text-[color:var(--color-text-dim)] leading-[1.75] whitespace-pre-wrap mb-4">
                  {formatScenario(s.content)}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(s.id)}
                  className="bg-[color:var(--color-accent)] text-black text-sm font-semibold px-4 py-2 rounded disabled:opacity-30 hover:brightness-110"
                >
                  {busy ? '섹션 생성 중...' : '이 시나리오로 진행 →'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 문장 단위 줄바꿈 (Gemini가 단락 구분 안 넣어줘도 보기 좋게) */
function formatScenario(content: string): string {
  if (content.includes('\n')) return content;
  return content.replace(/([.!?])\s+(?=[가-힣A-Z])/g, '$1\n\n');
}
