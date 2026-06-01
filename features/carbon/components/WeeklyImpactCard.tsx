'use client';

type WeeklyImpactCardProps = {
  avgSavedPerMeetingKg: number;
  isLight: boolean;
  meetingsCount: number;
  totalSavedKg: number;
};

export default function WeeklyImpactCard({
  avgSavedPerMeetingKg,
  isLight,
  meetingsCount,
  totalSavedKg,
}: WeeklyImpactCardProps) {
  return (
    <section
      className="rounded-3xl border p-6"
      style={{
        background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.04)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <h3 className="text-xl font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
        Weekly carbon impact
      </h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(0,229,186,0.24)', background: 'rgba(0,229,186,0.08)' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(0,229,186,0.9)' }}>
            Total saved
          </p>
          <p className="mt-2 text-lg font-black" style={{ color: 'rgb(0,229,186)' }}>
            {totalSavedKg.toFixed(2)} kg
          </p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(59,130,246,0.22)', background: 'rgba(59,130,246,0.08)' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#60a5fa' }}>
            Meetings
          </p>
          <p className="mt-2 text-lg font-black" style={{ color: '#60a5fa' }}>
            {meetingsCount}
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm" style={{ color: isLight ? '#475569' : '#9ca3af' }}>
        Avg per meeting:{' '}
        <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{avgSavedPerMeetingKg.toFixed(2)} kg</strong>
      </p>
    </section>
  );
}
