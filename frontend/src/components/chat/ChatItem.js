import React from "react";
import { IC } from "../../icons/Icons";

export default function ChatItem({ chat, active, pdfs, onLoad, onDelete, onOpenPdf }) {
  return (
    <div className={`chat-item ${active?"chat-item-active":""}`} onClick={()=>onLoad(chat.id)}>
      <div className="chat-item-inner">
        <IC.Chat/>
        <div className="chat-item-text">
          <p className="chat-title">{chat.title||"Untitled"}</p>
          <p className="chat-meta">{chat.pdfCount||0} PDF{chat.pdfCount!==1?"s":""}</p>
        </div>
        <button className="btn-icon btn-delete" onClick={e=>{e.stopPropagation();onDelete(e,chat.id);}}><IC.Trash/></button>
      </div>
      {active&&pdfs.length>0&&(
        <div className="pdf-list">
          {pdfs.map((p,i)=>(
            <button key={i} className="pdf-link" onClick={e=>{e.stopPropagation();onOpenPdf(p);}}>
              <IC.File/><span className="pdf-name">{p}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
