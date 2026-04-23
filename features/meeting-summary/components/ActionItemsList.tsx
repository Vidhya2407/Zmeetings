'use client';

type ActionItemsListProps = {
  items: string[];
  isLight: boolean;
};

export default function ActionItemsList({ items, isLight }: ActionItemsListProps) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        background: isLight ? 'rgba(248,250,252,0.95)' : 'rgba(255,255,255,0.03)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
        Action Items
      </p>
      <ul className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <li
            key={item}
            className="rounded-xl border px-3 py-2 text-xs"
            style={{
              borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
              color: isLight ? '#334155' : '#cbd5e1',
              background: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.5)',
            }}
          >
            {item}
          </li>
        )) : (
          <li className="text-xs" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
            No action items yet.
          </li>
        )}
      </ul>
    </section>
  );
}

