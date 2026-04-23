'use client';

type MeetingCarbonCardProps = {
  estimateLabel: string;
  isLight: boolean;
  participants: number;
  savedKg: number;
  status: 'scheduled' | 'live' | 'ended';
  title: string;
};

function savingsLabel(status: MeetingCarbonCardProps['status']) {
  if (status === 'scheduled') return 'Estimated CO2 savings';
  if (status === 'live') return 'Current CO2 savings';
  return 'CO2 saved';
}

export default function MeetingCarbonCard({
  estimateLabel,
  isLight,
  participants,
  savedKg,
  status,
  title,
}: MeetingCarbonCardProps) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        background: isLight ? 'rgba(248,250,252,0.95)' : 'rgba(255,255,255,0.03)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
        Meeting Carbon
      </p>
      <h4 className="mt-2 text-sm font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
        {title}
      </h4>
      <p className="mt-2 text-xs font-semibold" style={{ color: 'rgb(0,229,186)' }}>
        {estimateLabel}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border px-3 py-2" style={{ borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }}>
          <span style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{savingsLabel(status)}</span>
          <p className="mt-1 font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{savedKg.toFixed(2)} kg</p>
        </div>
        <div className="rounded-xl border px-3 py-2" style={{ borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }}>
          <span style={{ color: isLight ? '#64748b' : '#94a3b8' }}>Participants</span>
          <p className="mt-1 font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{participants}</p>
        </div>
      </div>
    </section>
  );
}
