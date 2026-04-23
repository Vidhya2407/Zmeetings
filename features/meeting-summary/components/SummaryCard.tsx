'use client';

type SummaryCardProps = {
  isLight: boolean;
  summary: string;
  title?: string;
};

export default function SummaryCard({ isLight, summary, title = 'Meeting Summary' }: SummaryCardProps) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        background: isLight ? 'rgba(248,250,252,0.95)' : 'rgba(255,255,255,0.03)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
        {title}
      </p>
      <p className="mt-2 text-sm leading-6" style={{ color: isLight ? '#334155' : '#cbd5e1' }}>
        {summary}
      </p>
    </section>
  );
}

