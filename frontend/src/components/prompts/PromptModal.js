import React from "react";
import { IC } from "../../icons/Icons";

export default function PromptModal({ type, value, onChange, onClose, onSave, onReset }) {
  const isSystem = type === "system";
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            {isSystem ? <IC.Prompt /> : <IC.User2 />}
            <h2 className="modal-title">
              {isSystem ? "System Prompt" : "User Prompt Prefix"}
            </h2>
          </div>
          <button className="modal-close" onClick={onClose}><IC.Close /></button>
        </div>
        <p className="modal-desc">
          {isSystem
            ? "Sets how the AI behaves — its personality, rules and constraints. Applied to every message."
            : "A prefix automatically added before every question you send. Useful for setting context or language."}
        </p>
        <textarea
          className="modal-textarea"
          value={value}
          onChange={e=>onChange(e.target.value)}
          placeholder={isSystem ? "Enter system instructions…" : "Enter user prompt prefix…"}
          rows={8}
          autoFocus
        />
        <div className="modal-footer">
          <button className="modal-btn-reset" onClick={onReset}>Reset to default</button>
          <div style={{display:"flex",gap:8}}>
            <button className="modal-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="modal-btn-save" onClick={()=>{onSave();onClose();}}>
              <IC.Save /><span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
