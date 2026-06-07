import React, { useState } from 'react';
import UploadDataset from '../../components/eda/UploadDataset';
import SummaryCards from '../../components/eda/SummaryCards';
import DatasetPreview from '../../components/eda/DatasetPreview';
import ChartsSection from '../../components/eda/ChartsSection';
import AIInsights from '../../components/eda/AIInsights';
import { IC } from '../../icons/Icons';

export default function EDA({ sessionData, setSessionData }) {
  const [downloading, setDownloading] = useState(false);

  const handleUploadSuccess = (data) => {
    setSessionData(data);
  };

  const handleDownloadReport = async () => {
    if (!sessionData?.session_id) return;

    setDownloading(true);
    try {
      const response = await fetch(`http://localhost:8000/eda/download-report/${sessionData.session_id}`);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      // Create a blob and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EDA_Report_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading report:', err);
      alert(`Failed to download report: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar" style={{ background: 'var(--off-white)' }}>
      <div className="max-w-7xl mx-auto p-8 pb-20">
        {!sessionData ? (
          <div className="empty-state" style={{ marginTop: '40px' }}>
            <div className="empty-icon" style={{ background: 'var(--grad)' }}>
              <IC.Activity size={30} />
            </div>
            <p className="empty-title">EDA Analysis</p>
            <p className="empty-sub">Upload CSV or Excel files to generate instant statistical reports, interactive charts, and AI-driven data insights.</p>

            <div className="empty-features" style={{ marginBottom: '40px' }}>
              <span className="feat-chip"><IC.Activity /> Automated Stats</span>
              <span className="feat-chip"><IC.Chat /> Plotly Visuals</span>
              <span className="feat-chip"><IC.Bot /> AI Predictions</span>
            </div>

            <div className="max-w-xl w-full mx-auto">
              <UploadDataset onUploadSuccess={handleUploadSuccess} />
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header with Download Button */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--text)' }}>
                  EDA Dashboard
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-md)' }}>
                  Analyzing: {sessionData.filename}
                </p>
              </div>
              <button
                onClick={handleDownloadReport}
                disabled={downloading}
                className="flex items-center gap-3 px-6 py-3 font-bold rounded-xl transition-all disabled:opacity-50"
                style={{
                  background: 'var(--grad)',
                  color: 'white',
                  boxShadow: '0 8px 24px rgba(240,101,0,0.25)',
                }}
              >
                {downloading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Generating Report...
                  </>
                ) : (
                  <>
                    <IC.Download size={20} />
                    Download Report
                  </>
                )}
              </button>
            </div>

            {/* Summary Stats */}
            <SummaryCards analysis={sessionData.analysis} />

            {/* AI Insights - High Priority */}
            <AIInsights sessionId={sessionData.session_id} />

            {/* Data Preview */}
            <DatasetPreview
              preview={sessionData.analysis.preview}
              columns={sessionData.analysis.column_names}
            />

            {/* Charts Visualizations */}
            <ChartsSection sessionId={sessionData.session_id} />
          </div>
        )}
      </div>
    </div>
  );
}
