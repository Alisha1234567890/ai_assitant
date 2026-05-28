import React, { useEffect, useState } from 'react';
import { IC } from '../../icons/Icons';

export default function AIInsights({ sessionId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetchInsights = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/eda/insights/${sessionId}`, {
          method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to load AI insights');
        const data = await res.json();
        setInsights(data.insights);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [sessionId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 rounded-3xl" style={{ background: 'var(--grad-soft)', border: '1.5px dashed var(--border-gold)' }}>
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[13px] font-bold uppercase tracking-widest" style={{ color: 'var(--orange)' }}>AI Analysis in progress...</p>
    </div>
  );

  if (error) return (
    <div className="p-4 rounded-xl text-red-500 text-center text-sm font-bold uppercase tracking-wide" style={{ background: 'rgba(220,50,50,0.05)', border: '1.5px solid rgba(220,50,50,0.1)' }}>
      {error}
    </div>
  );

  if (!insights) return null;

  const sections = [
    { title: 'Observed Trends', data: insights.trends, icon: <IC.Activity size={18} />, color: 'var(--orange)', bg: 'rgba(240,101,0,0.08)' },
    { title: 'Correlations', data: insights.correlations, icon: <IC.Prompt size={18} />, color: 'var(--blue)', bg: 'rgba(26,106,255,0.08)' },
    { title: 'Data Warnings', data: insights.missing_value_warnings, icon: <IC.Clear size={18} />, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
    { title: 'Recommendations', data: insights.recommendations, icon: <IC.Bot size={18} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  ];

  return (
    <div className="mb-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-grad flex items-center justify-center text-white shadow-lg">
          <IC.Bot size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold leading-none" style={{ color: 'var(--text)' }}>AI Smart Insights</h3>
          <p className="text-xs mt-1 font-semibold opacity-60 uppercase tracking-wider" style={{ color: 'var(--text-md)' }}>Powered by Groq Analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, i) => (
          section.data && section.data.length > 0 && (
            <div key={i} 
              style={{ background: 'var(--white)', border: '1.5px solid var(--border-gold)', borderRadius: 'var(--radius)' }}
              className="p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 rounded-xl flex items-center justify-center shadow-sm" style={{ background: section.bg, color: section.color }}>
                  {section.icon}
                </div>
                <h4 className="font-extrabold text-[13px] uppercase tracking-wider" style={{ color: 'var(--text)' }}>{section.title}</h4>
              </div>
              <ul className="space-y-4">
                {section.data.map((item, j) => (
                  <li key={j} className="flex gap-3 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-md)' }}>
                    <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: section.color, opacity: 0.4 }}></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
