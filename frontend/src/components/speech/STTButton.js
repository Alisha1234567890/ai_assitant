import React, { useState } from "react";
import { IC } from "../../icons/Icons";
import { LANGUAGES } from "../../constants";

export default function STTButton({ listening, supported, sttLang, setSttLang, onStart, onStop }) {
  const [showLang, setShowLang] = useState(false);
  if (!supported) return null;
  return (
    <div className="stt-wrap">
      {showLang && (
        <div className="stt-lang-panel">
          <p className="tts-label" style={{marginBottom:6}}>Mic Language</p>
          {LANGUAGES.map(l=>(
            <button key={l.code}
              className={`stt-lang-opt ${sttLang===l.code?"stt-lang-active":""}`}
              onClick={()=>{ setSttLang(l.code); setShowLang(false); }}>
              {l.label}
            </button>
          ))}
        </div>
      )}
      <button
        className={`btn-mic ${listening?"btn-mic-active":""}`}
        onClick={listening ? onStop : onStart}
        title={listening ? "Stop recording" : "Speak your question"}
      >
        {listening ? <><IC.MicOff /><span>Stop</span></> : <><IC.Mic /><span>Speak</span></>}
      </button>
      <button className="btn-mic-lang" onClick={()=>setShowLang(o=>!o)} title="Change mic language">
        <IC.Globe />
      </button>
    </div>
  );
}
