import React from "react";
import { IC } from "../../icons/Icons";

export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="mode-toggle">
      <button
        className={`mode-btn ${mode==="chat"?"mode-btn-active":""}`}
        onClick={()=>onChange("chat")}
        title="Free chat with AI — no PDF needed"
      >
        <IC.ChatBubble /><span>Chat</span>
      </button>
      <button
        className={`mode-btn ${mode==="rag"?"mode-btn-active":""}`}
        onClick={()=>onChange("rag")}
        title="Ask questions from your PDFs"
      >
        <IC.PDF /><span>PDF RAG</span>
      </button>
    </div>
  );
}
