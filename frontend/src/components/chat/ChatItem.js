import React from "react";
import { IC } from "../../icons/Icons";

export default function ChatItem({ chat, active, pdfs, onLoad, onDelete, onOpenPdf }) {
  return (
    <div className={`chat-item ${active ? "chat-item-active" : ""}`} onClick={() => onLoad(chat.id)}>
      <div className="chat-item-inner">
        <IC.Chat />
        <div className="chat-item-text">
          <p className="chat-title">{chat.title || "Untitled"}</p>
          <p className="chat-meta">{chat.pdfCount || 0} Document{chat.pdfCount !== 1 ? "s" : ""}</p>
        </div>
        <button className="btn-icon btn-delete" onClick={(e) => { e.stopPropagation(); onDelete(e, chat.id); }} title="Delete chat">
          <IC.Trash />
        </button>
      </div>

      {active && pdfs && pdfs.length > 0 && (
        <div className="pdf-list">
          {pdfs.map((p, i) => {
            const isMeta = typeof p === 'object' && p !== null;
            const name = isMeta ? p.name : p;
            const date = isMeta && p.uploadedAt ? new Date(p.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
            
            return (
              <button key={i} className="pdf-link" onClick={e => { e.stopPropagation(); onOpenPdf(name); }}>
                <IC.File />
                <div className="pdf-info">
                  <span className="pdf-name">{name}</span>
                  {date && <span className="pdf-date">{date}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
