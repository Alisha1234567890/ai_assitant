import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

export default function ChartsSection({ sessionId }) {
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetchCharts = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/eda/charts/${sessionId}`);
        if (!res.ok) throw new Error('Failed to load charts');
        const data = await res.json();
        setCharts(data.charts);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCharts();
  }, [sessionId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[13px] font-bold uppercase tracking-widest" style={{ color: 'var(--blue)' }}>Rendering Visualizations...</p>
    </div>
  );

  if (error) return (
    <div className="p-4 rounded-xl text-red-500 text-center text-sm font-bold uppercase tracking-wide" style={{ background: 'rgba(220,50,50,0.05)', border: '1.5px solid rgba(220,50,50,0.1)' }}>
      {error}
    </div>
  );

  if (!charts) return null;

  const chartKeys = Object.keys(charts).filter(k => charts[k] !== null);

  return (
    <div className="mb-10">
      <h3 className="text-lg font-bold mb-6 flex items-center gap-3" style={{ color: 'var(--text)' }}>
        <span className="w-1.5 h-6 rounded-full" style={{ background: 'var(--grad)' }}></span>
        Data Visualizations
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {chartKeys.map((key) => (
          <div key={key} 
            style={{ background: 'var(--white)', border: '1.5px solid var(--border-gold)', borderRadius: 'var(--radius)' }}
            className="p-6 shadow-sm hover:shadow-md transition-all h-[480px]"
          >
            <Plot
              data={charts[key].data}
              layout={{
                ...charts[key].layout,
                autosize: true,
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { family: 'Plus Jakarta Sans', size: 11, color: 'var(--text-md)' },
                margin: { l: 50, r: 20, t: 50, b: 50 },
                title: { ...charts[key].layout.title, font: { family: 'Plus Jakarta Sans', size: 14, weight: 700 } }
              }}
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
