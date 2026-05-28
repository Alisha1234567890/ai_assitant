import React, { useState } from 'react';
import { IC } from '../../icons/Icons';

export default function UploadDataset({ onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      setError('Please upload a CSV or Excel file.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:8000/eda/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      onUploadSuccess(data);
    } catch (err) {
      setError(err.message || 'Failed to upload dataset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-8">
      <div 
        className={`drop-area ${dragActive ? 'drop-active' : ''} ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ 
          background: 'var(--light)', 
          border: '1.5px dashed var(--border-gold)', 
          borderRadius: 'var(--radius)',
          transition: 'all 0.2s'
        }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById('eda-file-input').click()}
      >
        <input 
          id="eda-file-input" 
          type="file" 
          hidden 
          accept=".csv,.xlsx,.xls" 
          onChange={(e) => handleFile(e.target.files[0])} 
        />
        <div className="flex flex-col items-center gap-4 py-8">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
            style={{ background: 'var(--grad)' }}
          >
            <IC.Upload size={28} />
          </div>
          <div className="text-center">
            <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>
              {loading ? 'Processing Dataset...' : 'Click or drag to upload dataset'}
            </p>
            <p className="text-xs mt-1 font-medium opacity-60" style={{ color: 'var(--text-md)' }}>
              Supports CSV, XLSX up to 50MB
            </p>
          </div>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-[13px] font-bold text-red-500 text-center uppercase tracking-wide">{error}</p>
      )}
    </div>
  );
}
