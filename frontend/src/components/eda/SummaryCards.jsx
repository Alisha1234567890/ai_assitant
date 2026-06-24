import React from 'react';

export default function SummaryCards({ analysis }) {
  if (!analysis) return null;

  const cards = [
    { label: 'Total Rows', value: analysis.rows.toLocaleString(), icon: '📊', border: 'var(--border-blue)', text: 'var(--blue)' },
    { label: 'Total Columns', value: analysis.columns.toLocaleString(), icon: '📋', border: 'var(--border-gold)', text: 'var(--orange)' },
    { label: 'Missing Values', value: Object.values(analysis.missing_values).reduce((a, b) => a + b, 0).toLocaleString(), icon: '⚠️', border: 'var(--border-gold)', text: 'var(--yellow)' },
    { label: 'Duplicates', value: analysis.duplicates.toLocaleString(), icon: '👥', border: 'var(--border-blue)', text: 'var(--blue-deep)' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, i) => (
        <div key={i} 
          style={{ background: 'var(--white)', border: `1.5px solid ${card.border}`, borderRadius: 'var(--radius)' }}
          className="p-5 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="text-2xl group-hover:scale-110 transition-transform">{card.icon}</div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60" style={{ color: 'var(--text-md)' }}>{card.label}</p>
              <p className="text-xl font-extrabold" style={{ color: card.text }}>{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
