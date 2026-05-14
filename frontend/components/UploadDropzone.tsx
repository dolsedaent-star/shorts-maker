'use client';

import { useRef, useState } from 'react';
import { uploadFile, type AssetKind } from '@/lib/api';

export function UploadDropzone({
  sectionId,
  kind,
  hasFile,
  onUploaded,
}: {
  sectionId: string;
  kind: AssetKind;
  hasFile: boolean;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      await uploadFile(sectionId, kind, file);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setBusy(false);
    }
  }

  const accept = kind === 'video' ? 'video/*' : kind === 'audio' ? 'audio/*' : 'image/*';
  const label = kind === 'video' ? '영상' : kind === 'audio' ? '음성' : '이미지';

  return (
    <div
      className={`border-2 border-dashed rounded p-3 text-center text-sm transition ${
        hasFile
          ? 'border-[color:var(--color-success)] bg-[color:var(--color-success)]/5'
          : 'border-[color:var(--color-border)] hover:border-[color:var(--color-text-dim)]'
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full disabled:opacity-50"
      >
        {busy ? '업로드 중...' : hasFile ? `${label} ✓ (교체 클릭)` : `${label} 업로드 / 드래그`}
      </button>
      {error && <div className="text-[color:var(--color-danger)] text-xs mt-1">{error}</div>}
    </div>
  );
}
