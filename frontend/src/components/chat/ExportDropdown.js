import React, { useState, useRef, useEffect } from "react";
import { IC } from "../../icons/Icons";

export default function ExportDropdown({ onExport, loadingSummary }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const clickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const options = [
    { id: "pdf", label: "Full Chat (PDF)", icon: <IC.PDF />, desc: "Complete conversation history" },
    { id: "summary", label: "AI Summary (PDF)", icon: <IC.Summary />, desc: "Key points & takeaways", loading: loadingSummary },
    { id: "md", label: "Markdown (.md)", icon: <IC.FileText />, desc: "Formatted text for notes" },
    { id: "txt", label: "Plain Text (.txt)", icon: <IC.File />, desc: "Simple text export" },
  ];

  return (
    <div className="export-dropdown" ref={ref} style={{ position: "relative" }}>
      <button 
        className={`btn-icon-label ${open ? "active" : ""}`}
        onClick={() => setOpen(!open)}
        title="Export Chat"
      >
        <IC.Download />
        <span>Export</span>
      </button>

      {open && (
        <div className="export-menu">
          <div className="export-menu-header">Export Conversation</div>
          {options.map((opt) => (
            <button
              key={opt.id}
              className="export-item"
              disabled={opt.loading}
              onClick={() => {
                onExport(opt.id);
                setOpen(false);
              }}
            >
              <div className="export-item-icon">{opt.loading ? <div className="spinner-tiny" /> : opt.icon}</div>
              <div className="export-item-info">
                <div className="export-item-label">{opt.label}</div>
                <div className="export-item-desc">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .export-dropdown {
          position: relative;
        }
        .export-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 240px;
          background: var(--white);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(245,184,0,0.1);
          border: 1.5px solid var(--border-gold);
          z-index: 1000;
          overflow: hidden;
          animation: slideIn 0.2s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .export-menu-header {
          padding: 12px 16px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-dim);
          background: var(--light);
          border-bottom: 1.5px solid var(--border-gold);
        }
        .export-item {
          display: flex;
          align-items: flex-start;
          width: 100%;
          padding: 12px 16px;
          border: none;
          background: none;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
          gap: 12px;
        }
        .export-item:hover:not(:disabled) {
          background: var(--grad-soft);
        }
        .export-item:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .export-item-icon {
          flex-shrink: 0;
          margin-top: 2px;
          color: var(--orange);
        }
        .export-item-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }
        .export-item-desc {
          font-size: 11px;
          color: var(--text-dim);
          margin-top: 2px;
        }
        .spinner-tiny {
          width: 16px;
          height: 16px;
          border: 2px solid var(--border-gold);
          border-top-color: var(--orange);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
