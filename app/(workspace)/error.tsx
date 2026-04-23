'use client';

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">Workspace Error</p>
      <h2 className="mt-2 text-xl font-black text-white">Something went wrong while loading this section.</h2>
      <p className="mt-2 text-sm text-rose-100/80">{error.message || 'Unexpected error'}</p>
      <button
        className="mt-4 rounded-xl border border-rose-300/40 px-4 py-2 text-sm font-bold text-rose-100"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}

