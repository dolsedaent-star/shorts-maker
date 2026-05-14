'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { api } from '@/lib/api';
import { TONE_LABEL, type Project, type Tone } from '@/lib/types';

export default function NewProjectPage() {
  return (
    <AuthGate>
      <NewProjectForm />
    </AuthGate>
  );
}

function NewProjectForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    description: '',
    appName: '',
    targetUser: '',
    valueProposition: '',
    storeUrl: '',
    tone: 'INFORMATIVE' as Tone,
    defaultDurationS: 18,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = { ...form, storeUrl: form.storeUrl || undefined };
      const created = await api<Project>('/api/projects', { body: payload });
      router.replace(`/projects/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패');
    } finally {
      setLoading(false);
    }
  }

  function up<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <Link href="/" className="text-sm text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]">
        ← 목록으로
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">새 프로젝트</h1>

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="프로젝트 이름">
          <input
            value={form.name}
            onChange={(e) => up('name', e.target.value)}
            required
            className={inputCls}
            placeholder="예: 내 앱 출시 캠페인"
          />
        </Field>

        <Field label="앱 이름">
          <input
            value={form.appName}
            onChange={(e) => up('appName', e.target.value)}
            required
            className={inputCls}
            placeholder="예: 슬립트래커"
          />
        </Field>

        <Field label="이 캠페인으로 만들 영상에 대한 설명">
          <textarea
            value={form.description}
            onChange={(e) => up('description', e.target.value)}
            required
            rows={3}
            className={inputCls}
            placeholder="어떤 컨셉/메시지의 영상들을 만들지 자유롭게"
          />
        </Field>

        <Field label="타겟 사용자">
          <input
            value={form.targetUser}
            onChange={(e) => up('targetUser', e.target.value)}
            required
            className={inputCls}
            placeholder="예: 잠 못 자는 20대 직장인"
          />
        </Field>

        <Field label="핵심 가치 (왜 이 앱을 써야 하는가)">
          <textarea
            value={form.valueProposition}
            onChange={(e) => up('valueProposition', e.target.value)}
            required
            rows={2}
            className={inputCls}
            placeholder="예: 30초 만에 수면 패턴 진단"
          />
        </Field>

        <Field label="앱스토어 URL (선택)">
          <input
            type="url"
            value={form.storeUrl}
            onChange={(e) => up('storeUrl', e.target.value)}
            className={inputCls}
            placeholder="https://..."
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="톤">
            <select
              value={form.tone}
              onChange={(e) => up('tone', e.target.value as Tone)}
              className={inputCls}
            >
              {(Object.keys(TONE_LABEL) as Tone[]).map((t) => (
                <option key={t} value={t}>
                  {TONE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="기본 영상 길이 (초)">
            <input
              type="number"
              min={5}
              max={60}
              value={form.defaultDurationS}
              onChange={(e) => up('defaultDurationS', parseInt(e.target.value) || 18)}
              className={inputCls}
            />
          </Field>
        </div>

        {error && <div className="text-[color:var(--color-danger)] text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[color:var(--color-accent)] text-black font-semibold py-3 rounded disabled:opacity-40 hover:brightness-110"
        >
          {loading ? '생성 중...' : '프로젝트 생성'}
        </button>
      </form>
    </main>
  );
}

const inputCls =
  'w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-3 py-2 outline-none focus:border-[color:var(--color-accent)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-[color:var(--color-text-dim)] block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
