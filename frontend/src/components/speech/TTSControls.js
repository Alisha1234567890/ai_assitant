import React, { useState } from "react";
import { IC } from "../../icons/Icons";
import { LANGUAGES } from "../../constants";

export default function TTSControls({ ttsLang, setTtsLang, ttsRate, setTtsRate, speaking, onStop }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tts-controls">
      <button className={`tts-toggle-btn ${open?"tts-toggle-active":""}`} onClick={()=>setOpen(o=>!o)} title="TTS settings">
        <IC.Globe />
        <span>TTS</span>
        {speaking && <span className="tts-live-dot" />}
      </button>

      {speaking && (
        <button className="tts-stop-btn" onClick={onStop} title="Stop speaking">
          <IC.Stop /><span>Stop</span>
        </button>
      )}

      {open && (
        <div className="tts-panel">
          <div className="tts-panel-row">
            <label className="tts-label">Language</label>
            <select className="tts-select" value={ttsLang} onChange={e=>setTtsLang(e.target.value)}>
              {LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div className="tts-panel-row">
            <label className="tts-label">Speed: {ttsRate}x</label>
            <input type="range" className="tts-range" min="0.5" max="2" step="0.1"
              value={ttsRate} onChange={e=>setTtsRate(parseFloat(e.target.value))}/>
          </div>
        </div>
      )}
    </div>
  );
}
