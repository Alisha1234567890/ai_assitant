import React, { useState } from 'react';
import { IC } from '../../icons/Icons';

export default function AIInsights({ sessionId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateInsights = async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`http://localhost:8000/eda/insights/${sessionId}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to load AI insights');
      }
      const data = await res.json();
      setInsights(data.insights);
    } catch (err) {
      console.error('AI Insights error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // If we have an error, show the generate button with retry option
  if (error) {
    return (
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-grad flex items-center justify-center text-white shadow-lg">
            <IC.Bot size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold leading-none" style={{ color: 'var(--text)' }}>AI Smart Insights</h3>
            <p className="text-xs mt-1 font-semibold opacity-60 uppercase tracking-wider" style={{ color: 'var(--text-md)' }}>Optional: Powered by Groq</p>
          </div>
        </div>

        <div className="text-center py-12 rounded-3xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1.5px solid rgba(239,68,68,0.1)' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#ef4444' }}>
            {error}
          </p>
          <button
            onClick={generateInsights}
            className="flex items-center gap-3 px-6 py-3 font-bold rounded-xl transition-all mx-auto"
            style={{
              background: 'var(--grad)',
              color: 'white',
              boxShadow: '0 8px 24px rgba(240,101,0,0.25)',
            }}
          >
            <IC.Bot size={20} />
            Retry Generate AI Insights
          </button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="mb-10 flex flex-col items-center justify-center py-12 gap-4 rounded-3xl" style={{ background: 'var(--grad-soft)', border: '1.5px dashed var(--border-gold)' }}>
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[13px] font-bold uppercase tracking-widest" style={{ color: 'var(--orange)' }}>AI Analysis in progress...</p>
    </div>
  );

  if (!insights) {
    return (
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-grad flex items-center justify-center text-white shadow-lg">
            <IC.Bot size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold leading-none" style={{ color: 'var(--text)' }}>AI Smart Insights</h3>
            <p className="text-xs mt-1 font-semibold opacity-60 uppercase tracking-wider" style={{ color: 'var(--text-md)' }}>Optional: Powered by Groq</p>
          </div>
        </div>

        <div className="text-center py-12 rounded-3xl" style={{ background: 'var(--grad-soft)', border: '1.5px dashed var(--border-gold)' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-md)' }}>
            Get AI-powered insights for your dataset!
          </p>
          <button
            onClick={generateInsights}
            className="flex items-center gap-3 px-6 py-3 font-bold rounded-xl transition-all mx-auto"
            style={{
              background: 'var(--grad)',
              color: 'white',
              boxShadow: '0 8px 24px rgba(240,101,0,0.25)',
            }}
          >
            <IC.Bot size={20} />
            Generate AI Insights
          </button>
        </div>
      </div>
    );
  }

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
                {section.data.map((item, j) => {
                  let content;
                  if (typeof item === 'object' && item !== null) {
                    // Handle object items (like { column, trend })
                    content = Object.entries(item).map(([key, value]) => (
                      <span key={key} className="block">
                        <strong>{key}:</strong> {String(value)}
                      </span>
                    ));
                  } else {
                    // Handle string items
                    content = String(item);
                  }

                  return (
                    <li key={j} className="flex gap-3 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-md)' }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: section.color, opacity: 0.4 }}></span>
                      {content}
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
