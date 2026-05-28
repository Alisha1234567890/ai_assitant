import React, { useState } from 'react';
import UploadDataset from '../../components/eda/UploadDataset';
import SummaryCards from '../../components/eda/SummaryCards';
import DatasetPreview from '../../components/eda/DatasetPreview';
import ChartsSection from '../../components/eda/ChartsSection';
import AIInsights from '../../components/eda/AIInsights';
import { IC } from '../../icons/Icons';

export default function EDA({ sessionData, setSessionData }) {
  const handleUploadSuccess = (data) => {
    setSessionData(data);
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
