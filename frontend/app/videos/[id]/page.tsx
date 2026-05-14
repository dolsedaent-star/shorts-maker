'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { BgmUpload } from '@/components/BgmUpload';
import { ScenarioPicker } from '@/components/ScenarioPicker';
import { SectionEditor } from '@/components/SectionEditor';
import { Storyboard } from '@/components/Storyboard';
import { RenderProgress } from '@/components/RenderProgress';
import { SubtitleStyleEditor } from '@/components/SubtitleStyleEditor';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ANGLE_LABEL,
  VIDEO_STATUS_LABEL,
  type RenderArtifact,
  type Scenario,
  type Video,
} from '@/lib/types';

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <VideoWorkflow id={id} />
    </AuthGate>
  );
}

function VideoWorkflow({ id }: { id: string }) {
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api<Video>(`/api/videos/${id}`)
      .then((v) => {
        setVideo(v);
        // 진행 중 작업 자동 추적
        const active = v.renderJobs?.find((j) => j.status === 'QUEUED' || j.status === 'PROCESSING');
        if (active) setActiveJobId(active.id);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) return <div className="p-8 text-[color:var(--color-danger)]">{error}</div>;
  if (!video) return <div className="p-8 text-[color:var(--color-text-dim)]">불러오는 중...</div>;

  const selectedScenario = video.scenarios?.find((s) => s.id === video.selectedScenarioId);
  const allAssetsReady =
    !!video.sections?.length &&
    video.sections.every((s) => s.sourceVideoPath && s.sourceAudioPath);

  async function generateScenarios() {
    setBusy('scenarios');
    setError(null);
    try {
      await api(`/api/videos/${id}/scenarios`, { body: {} });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setBusy(null);
    }
  }

  async function selectScenario(scenarioId: string) {
    setBusy('select');
    setError(null);
    try {
      await api(`/api/videos/${id}/select-scenario`, { body: { scenarioId } });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '섹션 생성 실패');
    } finally {
      setBusy(null);
    }
  }

  async function startRender() {
    setBusy('render');
    setError(null);
    try {
      const { renderJobId } = await api<{ renderJobId: string }>(
        `/api/renders/videos/${id}/render`,
        { body: {} }
      );
      setActiveJobId(renderJobId);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '렌더 실패');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-8">
      <Link
        href={`/projects/${video.projectId}`}
        className="text-sm text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
      >
        ← {video.project?.name ?? '프로젝트'}
      </Link>

      <header className="mt-3 mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold truncate">{video.title}</h1>
          <div className="text-sm text-[color:var(--color-text-dim)] mt-1">
            {video.durationSeconds}초 ·{' '}
            <span className="text-[color:var(--color-accent-text)]">{VIDEO_STATUS_LABEL[video.status]}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)] text-[color:var(--color-danger)] text-sm rounded p-3 mb-6">
          {error}
        </div>
      )}

      {/* ── 1단계: 시나리오 ── */}
      <Section title="1. 시나리오">
        {video.status === 'DRAFT' || !video.scenarios?.length ? (
          <button
            onClick={generateScenarios}
            disabled={busy === 'scenarios'}
            className="bg-[color:var(--color-accent)] text-black font-semibold px-5 py-2.5 rounded disabled:opacity-40"
          >
            {busy === 'scenarios' ? 'AI 시나리오 작성 중... (10-20초)' : '시나리오 생성 (Gemini + Claude)'}
          </button>
        ) : selectedScenario ? (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded p-4">
            <div className="text-xs text-[color:var(--color-accent-text)] mb-1.5">
              선택됨 · {ANGLE_LABEL[selectedScenario.angle]}
            </div>
            <div className="font-bold text-lg mb-2">"{selectedScenario.hookLine}"</div>
            <p className="text-sm text-[color:var(--color-text-dim)] whitespace-pre-wrap">
              {selectedScenario.content}
            </p>
            <button
              onClick={generateScenarios}
              disabled={busy === 'scenarios'}
              className="mt-3 text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
            >
              ↻ 시나리오 다시 생성 (선택/섹션 초기화됨)
            </button>
          </div>
        ) : (
          <ScenarioPicker
            scenarios={video.scenarios}
            onSelect={selectScenario}
            busy={busy === 'select'}
          />
        )}
      </Section>

      {/* ── 2단계: 섹션 편집 + 자산 업로드 ── */}
      {video.sections && video.sections.length > 0 && (
        <Section title="2. 섹션 편집 + 자산 업로드">
          <p className="text-sm text-[color:var(--color-text-dim)] mb-4">
            워크플로우 순서: ① 이미지 프롬프트 복사 → 외부 도구(Nano Banana/GPT)로 콘티 이미지 생성 → 업로드
            ② 영상 프롬프트 재생성 (이미지 기반) → 외부 image-to-video 서비스로 영상 생성 → 업로드
            ③ 자막을 외부 TTS로 음성 생성 → 업로드.
            <br />
            <span className="text-[color:var(--color-accent-text)]">
              ※ 음성 길이가 섹션 길이와 ±0.5초 이내여야 함.
            </span>
          </p>

          {/* 콘티 스트립 */}
          <Storyboard
            sections={video.sections}
            onSectionClick={(sid) => setExpandedSectionId(sid)}
            onChanged={refresh}
          />

          <div className="space-y-2">
            {video.sections.map((s) => (
              <div key={s.id} id={`section-${s.id}`}>
                <SectionEditor
                  section={s}
                  onChanged={refresh}
                  expanded={expandedSectionId === s.id}
                  onToggle={() =>
                    setExpandedSectionId(expandedSectionId === s.id ? null : s.id)
                  }
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 3단계: 렌더링 ── */}
      {video.sections && video.sections.length > 0 && (
        <Section title="3. 렌더링">
          <SubtitleStyleEditor
            videoId={video.id}
            currentOverride={(video.subtitleStyleOverride as Record<string, unknown> | null) ?? null}
            projectStyle={(video.project?.subtitleStyle as Record<string, unknown> | null) ?? null}
            onChanged={refresh}
          />
          <BgmUpload videoId={video.id} hasBgm={!!video.bgmPath} onChanged={refresh} />
          {activeJobId ? (
            <RenderProgress
              jobId={activeJobId}
              onDone={() => {
                setActiveJobId(null);
                refresh();
              }}
              onFailed={() => {
                setActiveJobId(null);
                refresh();
              }}
            />
          ) : (
            <button
              onClick={startRender}
              disabled={!allAssetsReady || busy === 'render'}
              className="bg-[color:var(--color-accent)] text-black font-semibold px-5 py-2.5 rounded disabled:opacity-30"
            >
              {busy === 'render'
                ? '큐 등록 중...'
                : allAssetsReady
                ? '렌더링 시작'
                : '모든 섹션의 영상+음성 업로드 필요'}
            </button>
          )}
        </Section>
      )}

      {/* ── 4단계: 결과 (버전 누적) ── */}
      {video.renderArtifacts && video.renderArtifacts.length > 0 && (
        <Section title="4. 결과">
          <ArtifactsList artifacts={video.renderArtifacts} />
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function ArtifactsList({ artifacts }: { artifacts: RenderArtifact[] }) {
  const base = process.env.NEXT_PUBLIC_API_URL;
  const token = getToken();
  const latest = artifacts[0];
  const urlFor = (id: string) => `${base}/api/renders/artifacts/${id}/download?token=${token}`;
  return (
    <div className="space-y-4">
      <div className="bg-black rounded-lg overflow-hidden max-w-sm mx-auto aspect-[9/16]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          key={latest.id}
          src={urlFor(latest.id)}
          controls
          className="w-full h-full"
        />
      </div>
      <div className="space-y-2">
        {artifacts.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded px-4 py-2.5 text-sm"
          >
            <div>
              <span className="font-semibold">v{a.version}</span>{' '}
              <span className="text-[color:var(--color-text-dim)]">
                · {(Number(a.fileSizeBytes) / 1024 / 1024).toFixed(1)}MB ·{' '}
                {a.durationActualSeconds.toFixed(1)}s ·{' '}
                {new Date(a.createdAt).toLocaleString('ko-KR')}
              </span>
            </div>
            <a
              href={urlFor(a.id)}
              className="text-[color:var(--color-accent-text)] hover:underline"
              download={`final-v${a.version}.mp4`}
            >
              다운로드
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
