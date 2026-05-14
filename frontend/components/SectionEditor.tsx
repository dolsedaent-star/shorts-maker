'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { Section, TrimField } from '@/lib/types';
import { UploadDropzone } from './UploadDropzone';

export function SectionEditor({
  section,
  onChanged,
  expanded,
  onToggle,
}: {
  section: Section;
  onChanged: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [script, setScript] = useState(section.scriptText);
  const [prompt, setPrompt] = useState(section.videoPrompt);
  const [imgPrompt, setImgPrompt] = useState(section.imagePrompt ?? '');
  const [trimField, setTrimField] = useState<TrimField | null>(null);
  const [trimInstruction, setTrimInstruction] = useState('');
  const [trimBusy, setTrimBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [imgPromptBusy, setImgPromptBusy] = useState(false);
  const [vidRegenBusy, setVidRegenBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const scriptDirty = script !== section.scriptText;
  const promptDirty = prompt !== section.videoPrompt;
  const hasImage = !!section.sourceImagePath;
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const token = getToken();

  async function saveManual(field: TrimField, value: string) {
    setError(null);
    setSaveBusy(true);
    try {
      await api(`/api/sections/${section.id}`, {
        method: 'PATCH',
        body: { field, newText: value },
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaveBusy(false);
    }
  }

  async function runTrim() {
    if (!trimField || !trimInstruction.trim()) return;
    setError(null);
    setTrimBusy(true);
    try {
      const result = await api<{ after: string }>(`/api/sections/${section.id}/trim`, {
        body: { field: trimField, userInstruction: trimInstruction },
      });
      if (trimField === 'SCRIPT_TEXT') setScript(result.after);
      else setPrompt(result.after);
      setTrimInstruction('');
      setTrimField(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trim 실패');
    } finally {
      setTrimBusy(false);
    }
  }

  async function generateImgPrompt() {
    setError(null);
    setImgPromptBusy(true);
    try {
      const { imagePrompt } = await api<{ imagePrompt: string }>(
        `/api/sections/${section.id}/generate-image-prompt`,
        { body: {} }
      );
      setImgPrompt(imagePrompt);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패');
    } finally {
      setImgPromptBusy(false);
    }
  }

  async function regenerateVideoPrompt() {
    setError(null);
    setVidRegenBusy(true);
    try {
      const { after } = await api<{ after: string }>(
        `/api/sections/${section.id}/regenerate-video-prompt`,
        { body: {} }
      );
      setPrompt(after);
      setShowPrompt(true); // 결과 바로 보이게 자동 펼침
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '재생성 실패');
    } finally {
      setVidRegenBusy(false);
    }
  }

  return (
    <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg overflow-hidden">
      {/* 헤더 (항상 표시, 클릭으로 토글) */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-[color:var(--color-surface-2)] transition"
      >
        <span className="text-[color:var(--color-text-dim)] text-sm w-4">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="text-sm font-semibold shrink-0">
          섹션 {section.orderIndex}
        </span>
        <span className="text-xs text-[color:var(--color-text-dim)] shrink-0">
          {section.durationSeconds}s
        </span>
        <StatusPill label="콘티" ok={hasImage} />
        <StatusPill label="영상" ok={!!section.sourceVideoPath} />
        <StatusPill label="음성" ok={!!section.sourceAudioPath} />
        <span className="flex-1 text-xs text-[color:var(--color-text-dim)] truncate ml-2">
          {section.scriptText.replace(/\n/g, ' ').slice(0, 60)}
        </span>
      </button>

      {/* 본문 (펼침) */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-[color:var(--color-border)]">

      {/* 콘티 이미지 블록 */}
      <div className="bg-[color:var(--color-surface-2)] rounded p-3 mb-4 flex gap-3">
        {/* 썸네일 + 다운로드 */}
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <div className="w-20 aspect-[9/16] bg-[color:var(--color-bg)] rounded overflow-hidden flex items-center justify-center border border-[color:var(--color-border)]">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${apiBase}/api/sections/${section.id}/image?token=${token}`}
                alt={`section ${section.orderIndex}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] text-[color:var(--color-text-dim)] text-center">콘티<br/>없음</span>
            )}
          </div>
          {hasImage && (
            <a
              href={`${apiBase}/api/sections/${section.id}/image?token=${token}`}
              download={`section-${section.orderIndex}.png`}
              className="text-[10px] text-[color:var(--color-accent-text)] hover:underline"
              title="원본 이미지 다운로드"
            >
              ⬇ 다운로드
            </a>
          )}
        </div>
        {/* 프롬프트 + 업로드 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-[color:var(--color-text-dim)]">이미지 프롬프트 (영문)</label>
            <div className="flex gap-3">
              {imgPrompt && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(imgPrompt)}
                  className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
                >
                  📋 복사
                </button>
              )}
              <button
                type="button"
                onClick={generateImgPrompt}
                disabled={imgPromptBusy}
                className="text-xs text-[color:var(--color-accent-text)] hover:underline disabled:opacity-40"
              >
                {imgPromptBusy ? '생성 중...' : imgPrompt ? '↻ AI 재생성' : 'AI 생성'}
              </button>
            </div>
          </div>
          <textarea
            value={imgPrompt}
            onChange={(e) => setImgPrompt(e.target.value)}
            rows={2}
            placeholder="이미지 프롬프트가 비어있습니다. AI 생성 클릭 또는 직접 작성."
            className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-[color:var(--color-accent)]"
          />
          <div className="mt-2 flex gap-2">
            <div className="flex-1">
              <UploadDropzone
                sectionId={section.id}
                kind="image"
                hasFile={hasImage}
                onUploaded={onChanged}
              />
            </div>
            {hasImage && (
              <button
                type="button"
                onClick={regenerateVideoPrompt}
                disabled={vidRegenBusy}
                className="shrink-0 text-xs bg-[color:var(--color-accent)] text-black font-semibold px-3 py-2 rounded disabled:opacity-30 hover:brightness-110 whitespace-nowrap"
                title="업로드한 이미지를 보고 영상 프롬프트를 다시 작성"
              >
                {vidRegenBusy ? '...' : '🎬 영상 프롬프트 재생성'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video prompt (이미지 블록 바로 아래) */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowPrompt(!showPrompt)}
          className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
        >
          {showPrompt ? '▾' : '▸'} 영상 생성 프롬프트 (외부 image-to-video 서비스에 넣을 영문)
        </button>
        {showPrompt && (
          <>
            <div className="flex justify-end gap-2 mt-1.5 mb-1">
              <button
                type="button"
                onClick={() => setTrimField(trimField === 'VIDEO_PROMPT' ? null : 'VIDEO_PROMPT')}
                className="text-xs text-[color:var(--color-accent-text)] hover:underline"
              >
                {trimField === 'VIDEO_PROMPT' ? 'Trim 취소' : 'AI Trim'}
              </button>
              {promptDirty && (
                <button
                  type="button"
                  onClick={() => saveManual('VIDEO_PROMPT', prompt)}
                  disabled={saveBusy}
                  className="text-xs text-[color:var(--color-accent-text)] hover:underline"
                >
                  저장
                </button>
              )}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-3 py-2 text-xs font-mono outline-none focus:border-[color:var(--color-accent)]"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(prompt)}
              className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] mt-1"
            >
              📋 복사
            </button>
          </>
        )}
      </div>

      {/* Script (자막=대본 통합) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-[color:var(--color-text-dim)]">자막 / TTS 대본</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTrimField(trimField === 'SCRIPT_TEXT' ? null : 'SCRIPT_TEXT')}
              className="text-xs text-[color:var(--color-accent-text)] hover:underline"
            >
              {trimField === 'SCRIPT_TEXT' ? 'Trim 취소' : 'AI Trim'}
            </button>
            {scriptDirty && (
              <button
                type="button"
                onClick={() => saveManual('SCRIPT_TEXT', script)}
                disabled={saveBusy}
                className="text-xs text-[color:var(--color-accent-text)] hover:underline"
              >
                저장
              </button>
            )}
          </div>
        </div>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={3}
          className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)] font-sans"
        />
      </div>

      {/* Trim 패널 */}
      {trimField && (
        <div className="bg-[color:var(--color-surface-2)] rounded p-3 mb-4 border border-[color:var(--color-border)]">
          <div className="text-xs text-[color:var(--color-text-dim)] mb-1.5">
            {trimField === 'SCRIPT_TEXT' ? '자막/대본' : '영상 프롬프트'} 다듬기 지시
          </div>
          <input
            value={trimInstruction}
            onChange={(e) => setTrimInstruction(e.target.value)}
            placeholder="예: 더 짧고 후킹 강하게"
            className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-2 py-1.5 text-sm outline-none focus:border-[color:var(--color-accent)]"
          />
          <button
            type="button"
            onClick={runTrim}
            disabled={trimBusy || !trimInstruction.trim()}
            className="mt-2 bg-[color:var(--color-accent)] text-black text-sm font-semibold px-3 py-1.5 rounded disabled:opacity-40"
          >
            {trimBusy ? '다듬는 중...' : 'AI Trim 실행'}
          </button>
        </div>
      )}

      {/* 영상/음성 업로드 */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[color:var(--color-border)]">
        <UploadDropzone
          sectionId={section.id}
          kind="video"
          hasFile={!!section.sourceVideoPath}
          onUploaded={onChanged}
        />
        <UploadDropzone
          sectionId={section.id}
          kind="audio"
          hasFile={!!section.sourceAudioPath}
          onUploaded={onChanged}
        />
      </div>

      {error && <div className="text-[color:var(--color-danger)] text-xs mt-2">{error}</div>}
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
        ok
          ? 'bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]'
          : 'bg-[color:var(--color-border)]/50 text-[color:var(--color-text-dim)]'
      }`}
    >
      {label} {ok ? '✓' : '·'}
    </span>
  );
}
