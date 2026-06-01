import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'linear-gradient(180deg, #07111f 0%, #0a1320 48%, #071814 100%)' }}
    >
      <div
        className="max-w-lg rounded-[2rem] border px-8 py-10 text-center"
        style={{
          background: 'rgba(15,23,42,0.76)',
          borderColor: 'rgba(255,255,255,0.10)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: '#94a3b8' }}>
          Not Found
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight" style={{ color: '#f8fafc' }}>
          This page is not available.
        </h1>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>
          The link may be outdated, or the content may have moved. You can continue from the login page.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: 'rgba(0,229,186,0.9)', color: '#042f2e' }}
          >
            Go to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
