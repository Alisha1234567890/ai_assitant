import React from 'react';

export default function DatasetPreview({ preview, columns }) {
  if (!preview || preview.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-3" style={{ color: 'var(--text)' }}>
        <span className="w-1.5 h-6 rounded-full" style={{ background: 'var(--grad)' }}></span>
        Dataset Preview (First 5 Rows)
      </h3>
      <div 
        className="shadow-sm overflow-hidden"
        style={{ background: 'var(--white)', border: '1.5px solid var(--border-gold)', borderRadius: 'var(--radius)' }}
      >
        <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10" style={{ background: 'var(--light)' }}>
              <tr>
                {columns.map((col, i) => (
                  <th key={i} className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider opacity-60 border-b border-gray-100 dark:border-gray-800" style={{ color: 'var(--text-md)' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  {columns.map((col, j) => (
                    <td key={j} className="px-5 py-3 text-[13px] border-b border-gray-50 dark:border-gray-800 whitespace-nowrap" style={{ color: 'var(--text-md)' }}>
                      {row[col] === null ? <span className="text-gray-400 italic">null</span> : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
