'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await api<{ token: string }>('/api/auth/login', {
        body: { password },
      });
      setToken(token);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-8 space-y-5"
      >
        <div>
          <h1 className="text-2xl font-bold mb-1">Vibe Video</h1>
          <p className="text-sm text-[color:var(--color-text-dim)]">비밀번호 입력</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded px-4 py-3 outline-none focus:border-[color:var(--color-accent)] tracking-widest text-center text-lg"
          placeholder="••••••"
        />
        {error && (
          <div className="text-sm text-[color:var(--color-danger)]">{error}</div>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-[color:var(--color-accent)] text-black font-semibold py-3 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
        >
          {loading ? '확인 중...' : '입장'}
        </button>
      </form>
    </div>
  );
}
