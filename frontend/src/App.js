import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const BASE    = "http://localhost:8000";
const USER_ID = "user123";
const sleep   = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeText(text, cb) {
  if (!text || typeof text !== "string") { cb("No response"); return; }
  let out = "";
  for (const ch of text) { out += ch; cb(out); await sleep(6); }
}

/* ─── icons ─────────────────────────────────────────────── */
const IC = {
  Plus:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="ic"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>,
  Trash:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
  Send:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  File:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  Upload: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>,
  Clear:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
  Bot:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="ic"><rect x="3" y="8" width="18" height="13" rx="2"/><path strokeLinecap="round" d="M8 8V6a4 4 0 018 0v2"/><circle cx="9.5" cy="14.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.5" cy="14.5" r="1.5" fill="currentColor" stroke="none"/><path strokeLinecap="round" d="M9.5 18.5h5"/></svg>,
  Chat:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>,
  X:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="ic"><path strokeLinecap="round" d="M6 6l12 12M6 18L18 6"/></svg>,
  Check:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
  // TTS icon
  Volume: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z"/><path strokeLinecap="round" d="M15.54 8.46a5 5 0 010 7.07"/><path strokeLinecap="round" d="M19.07 4.93a10 10 0 010 14.14"/></svg>,
  // STT icon - mic
  Mic:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/><line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/></svg>,
  // STT stop icon
  MicOff: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ic"><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/><path strokeLinecap="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path strokeLinecap="round" d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/><line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/></svg>,
  Stop:   () => <svg viewBox="0 0 24 24" fill="currentColor" className="ic"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>,
  Globe:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="ic"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  Prompt: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path strokeLinecap="round" d="M9 12h6M9 16h4"/></svg>,
  User2:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="ic"><circle cx="12" cy="8" r="4"/><path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  Close:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="ic"><path strokeLinecap="round" d="M6 6l12 12M6 18L18 6"/></svg>,
  Save:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>,
  PDF:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>,
  ChatBubble: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="ic"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>,
};

/* ─── dots ───────────────────────────────────────────────── */
function Dots() {
  return (
    <span className="dots-wrap">
      {[0,1,2].map(i=><span key={i} className="dot" style={{animationDelay:`${i*0.18}s`}}/>)}
    </span>
  );
}

/* ═══════════════════════════════════════════════
   TTS — Text-to-Speech (Web Speech API, free)
═══════════════════════════════════════════════ */
const LANGUAGES = [
  { code:"en-US", label:"English (US)"   },
  { code:"en-GB", label:"English (UK)"   },
  { code:"hi-IN", label:"Hindi"          },
  { code:"fr-FR", label:"French"         },
  { code:"es-ES", label:"Spanish"        },
  { code:"de-DE", label:"German"         },
  { code:"ar-SA", label:"Arabic"         },
  { code:"zh-CN", label:"Chinese (CN)"   },
  { code:"ja-JP", label:"Japanese"       },
  { code:"pt-BR", label:"Portuguese (BR)"},
  { code:"ko-KR", label:"Korean"         },
  { code:"ru-RU", label:"Russian"        },
];

// Global TTS state so only one speaks at a time
let currentUtterance = null;

function useTTS() {
  const [speaking,   setSpeaking]   = useState(false);
  const [ttsLang,    setTtsLang]    = useState("en-US");
  const [ttsRate,    setTtsRate]    = useState(1);

  const speak = useCallback((text) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang  = ttsLang;
    u.rate  = ttsRate;
    u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    currentUtterance = u;
    window.speechSynthesis.speak(u);
  }, [ttsLang, ttsRate]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, ttsLang, setTtsLang, ttsRate, setTtsRate };
}

/* ═══════════════════════════════════════════════
   STT — Speech-to-Text (Web Speech API, free)
═══════════════════════════════════════════════ */
function useSTT({ onResult, onInterim, sttLang }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recogRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported. Use Chrome or Edge."); return; }

    window.speechSynthesis.cancel(); // stop TTS before mic opens

    const r = new SR();
    r.lang            = sttLang;
    r.continuous      = true;       // keep listening until user stops
    r.interimResults  = true;       // show partial results live
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) onInterim(interim);
      if (final)   onResult(final);
    };

    r.onerror = (e) => {
      console.error("STT error:", e.error);
      setListening(false);
      if (e.error === "not-allowed") alert("Microphone permission denied. Please allow mic access.");
    };

    r.onend = () => setListening(false);

    recogRef.current = r;
    r.start();
    setListening(true);
  }, [sttLang, onResult, onInterim]);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, startListening, stopListening };
}

/* ─── TTS controls bar ───────────────────────────────────── */
function TTSControls({ ttsLang, setTtsLang, ttsRate, setTtsRate, speaking, onStop }) {
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

/* ─── Prompt Modal ───────────────────────────────────────── */
const DEFAULT_SYSTEM = `You are a helpful AI assistant that answers questions strictly based on document context.
Rules:
1. Only use information from the CONTEXT block.
2. If the answer is not in the context, say 'Not found in the document'.
3. Be concise. Use bullet points when listing multiple items.
4. Never make up information.`;

const DEFAULT_USER = `Answer my question based on the uploaded documents. Be clear and concise.`;

function PromptModal({ type, value, onChange, onClose, onSave, onReset }) {
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

/* ─── Mode Toggle ────────────────────────────────────────── */
function ModeToggle({ mode, onChange }) {
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

/* ─── Prompt Button (shown in topbar) ───────────────────── */
function PromptButtons({ onOpenSystem, systemActive }) {
  return (
    <div className="prompt-btns">
      <button
        className={`prompt-btn ${systemActive?"prompt-btn-active":""}`}
        onClick={onOpenSystem}
        title="Edit system prompt"
      >
        <IC.Prompt />
        <span>System</span>
        {systemActive && <span className="prompt-dot" />}
      </button>
    </div>
  );
}
function STTButton({ listening, supported, sttLang, setSttLang, onStart, onStop }) {
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

/* ─── Bubble ─────────────────────────────────────────────── */
function Bubble({ msg, onSpeak, speaking }) {
  const isUser = msg.type === "user";
  return (
    <div className={`bubble-row ${isUser?"bubble-right":"bubble-left"}`}>
      {!isUser && <div className="avatar avatar-bot"><IC.Bot /></div>}
      <div className={`bubble ${isUser?"bubble-user":"bubble-ai"}`}>
        {msg.typing ? <Dots /> : (msg.text || <Dots />)}
      </div>
      {!isUser && !msg.typing && msg.text && (
        <button
          className={`speak-btn ${speaking?"speak-btn-active":""}`}
          onClick={() => onSpeak(msg.text)}
          title="Read aloud"
        >
          <IC.Volume />
        </button>
      )}
      {isUser && <div className="avatar avatar-user">{USER_ID[0].toUpperCase()}</div>}
    </div>
  );
}

/* ─── FilePill ───────────────────────────────────────────── */
function FilePill({ file, onRemove, status }) {
  const cls={pending:"pill-pending",uploading:"pill-uploading",done:"pill-done",error:"pill-error"};
  return (
    <div className={`file-pill ${cls[status]||cls.pending}`}>
      <IC.File/>
      <span className="file-pill-name">{file.name}</span>
      <span className="file-pill-size">{(file.size/1024).toFixed(0)}kb</span>
      {status==="uploading"&&<Dots/>}
      {status==="done"&&<IC.Check/>}
      {status==="error"&&<IC.X/>}
      {status==="pending"&&<button className="pill-remove" onClick={()=>onRemove(file.name)}><IC.X/></button>}
    </div>
  );
}

/* ─── UploadZone ─────────────────────────────────────────── */
function UploadZone({ onUpload, uploading, fileStatuses }) {
  const [files, setFiles] = useState([]);
  const [drag,  setDrag]  = useState(false);
  const ref = useRef();

  const addFiles = (inc) => {
    const pdfs=Array.from(inc).filter(f=>f.type==="application/pdf");
    const bad=Array.from(inc).filter(f=>f.type!=="application/pdf");
    if(bad.length) alert(`Skipped ${bad.length} non-PDF file(s).`);
    if(!pdfs.length) return;
    setFiles(prev=>{const n=new Set(prev.map(f=>f.name));return[...prev,...pdfs.filter(f=>!n.has(f.name))];});
  };

  const removeFile = n => setFiles(prev=>prev.filter(f=>f.name!==n));
  const clearAll   = () => setFiles([]);
  const submit     = () => { if(!files.length){alert("Add at least one PDF");return;} onUpload(files,clearAll); };

  return (
    <div className="upload-zone">
      {files.length>0 && (
        <div className="file-queue">
          {files.map(f=><FilePill key={f.name} file={f} onRemove={removeFile} status={fileStatuses[f.name]||"pending"}/>)}
        </div>
      )}
      <div className="upload-controls">
        <div
          className={`drop-area ${drag?"drop-active":""} ${files.length?"drop-has-file":""}`}
          onDragOver={e=>{e.preventDefault();setDrag(true);}}
          onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files);}}
          onClick={()=>ref.current.click()}
        >
          <IC.Upload/>
          <span>{files.length?`${files.length} PDF${files.length>1?"s":""} ready — click to add more`:"Drop PDFs here or click to browse"}</span>
          <input ref={ref} type="file" accept="application/pdf" multiple hidden onChange={e=>{addFiles(e.target.files);e.target.value="";}}/>
        </div>
        <button className="btn-upload" onClick={submit} disabled={!files.length||uploading}>
          {uploading?<Dots/>:<><IC.Upload/><span>Upload {files.length>1?`${files.length} PDFs`:"PDF"}</span></>}
        </button>
      </div>
    </div>
  );
}

/* ─── ChatItem ───────────────────────────────────────────── */
function ChatItem({ chat, active, pdfs, onLoad, onDelete, onOpenPdf }) {
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

/* ═══════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════ */
export default function App() {
  const [chatList,     setChatList]     = useState([]);
  const [chatId,       setChatId]       = useState(null);
  const [chatPdfs,     setChatPdfs]     = useState([]);
  const [messages,     setMessages]     = useState([]);
  const [question,     setQuestion]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [fileStatuses, setFileStatuses] = useState({});
  const [sttLang,      setSttLang]      = useState("en-US");
  const [interimText,  setInterimText]  = useState(""); // live mic preview

  // Prompt state
  const [systemPrompt,     setSystemPrompt]     = useState(DEFAULT_SYSTEM);
  const [showSystemModal,  setShowSystemModal]  = useState(false);
  const [editSystem,       setEditSystem]       = useState(DEFAULT_SYSTEM);
  // Mode: "chat" = free AI chat, "rag" = PDF document Q&A
  const [mode, setMode] = useState("rag");

  const bottomRef = useRef();
  const inputRef  = useRef();

  // TTS hook
  const { speak, stop: stopTTS, speaking, ttsLang, setTtsLang, ttsRate, setTtsRate } = useTTS();

  // STT hook
  const { listening, supported: sttSupported, startListening, stopListening } = useSTT({
    sttLang,
    onInterim: (text) => {
      setInterimText(text);
      setQuestion(prev => {
        // replace interim portion at end
        const base = prev.replace(/\[listening….*?\]$/, "").trimEnd();
        return base ? base + " " + text : text;
      });
    },
    onResult: (text) => {
      setInterimText("");
      setQuestion(prev => {
        const base = prev.replace(/\[listening….*?\]$/, "").trimEnd();
        // append final result
        const combined = base ? base + " " + text : text;
        return combined;
      });
      inputRef.current?.focus();
    },
  });

  useEffect(()=>{ fetchChats(); },[]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const fetchChats = async () => {
    try { const r=await axios.get(`${BASE}/chats/${USER_ID}`); setChatList(r.data.chats||[]); } catch{}
  };

  const loadChat = useCallback(async(id)=>{
    setChatId(id);
    try {
      const r=await axios.get(`${BASE}/chat/${id}`);
      setMessages((r.data.messages||[]).map(m=>({type:m.role,text:m.text})));
      setChatPdfs(r.data.pdfs||[]);
    } catch(e){console.error(e);}
  },[]);

  const newChat = ()=>{ setChatId(null);setMessages([]);setQuestion("");setChatPdfs([]);setFileStatuses({}); };

  const handleUpload = async(files,clearFiles)=>{
    setUploading(true);
    const init={};files.forEach(f=>{init[f.name]="uploading";});setFileStatuses(init);
    const fd=new FormData();
    files.forEach(f=>fd.append("files",f));
    fd.append("chatId",chatId??"null"); fd.append("userId",USER_ID);
    try {
      const r=await axios.post(`${BASE}/upload`,fd);
      if(r.data.error){const e={};files.forEach(f=>{e[f.name]="error";});setFileStatuses(e);alert("Upload failed: "+r.data.error);}
      else {
        const ns={};
        (r.data.uploaded||[]).forEach(u=>{ns[u.name]="done";});
        (r.data.failed||[]).forEach(u=>{ns[u.name]="error";});
        setFileStatuses(ns);
        const cid=r.data.chatId; setChatId(cid);
        await fetchChats(); await loadChat(cid);
        const up=r.data.uploaded||[],fa=r.data.failed||[];
        let sum=up.map(u=>`✅ ${u.name} — ${u.pages} pages, ${u.chunks} chunks`).join("\n");
        if(fa.length) sum+="\n"+fa.map(f=>`❌ ${f.name}: ${f.error}`).join("\n");
        sum+=`\n\nTotal indexed: ${r.data.total_chunks} chunks. Ask me anything!`;
        setMessages(prev=>[...prev,{type:"bot",text:sum}]);
        setTimeout(clearFiles,1800);
      }
    } catch(e){console.error(e);const er={};files.forEach(f=>{er[f.name]="error";});setFileStatuses(er);alert("Upload failed — is the backend running?");}
    setUploading(false);
  };

  const handleAsk = async()=>{
    const q=question.trim(); if(!q||loading)return;
    stopListening();
    setQuestion(""); setInterimText("");
    setMessages(prev=>[...prev,{type:"user",text:q}]);
    setLoading(true);
    setMessages(prev=>[...prev,{type:"bot",text:"",typing:true}]);
    try {
      const r=await axios.post(`${BASE}/ask`,{
        question: q,
        chatId,
        userId: USER_ID,
        systemPrompt: systemPrompt.trim() || undefined,
        mode,
      });
      const answer=r?.data?.answer??"⚠️ No response";
      if(r?.data?.chatId){setChatId(r.data.chatId);fetchChats();}
      setMessages(prev=>{const u=[...prev];u[u.length-1]={type:"bot",text:""};return u;});
      await typeText(answer,typed=>{
        setMessages(prev=>{const u=[...prev];u[u.length-1]={type:"bot",text:typed};return u;});
      });
    } catch {
      setMessages(prev=>{const u=[...prev];u[u.length-1]={type:"bot",text:"❌ Failed to get response."};return u;});
    }
    setLoading(false); inputRef.current?.focus();
  };

  const clearChat  = async()=>{ if(!chatId)return; await axios.delete(`${BASE}/chat/${chatId}`).catch(()=>{}); setMessages([]); };
  const deleteChat = async(e,id)=>{ e.stopPropagation(); if(!window.confirm("Delete this chat?"))return; await axios.delete(`${BASE}/delete/${id}`).catch(()=>{}); if(chatId===id)newChat(); fetchChats(); };
  const openPdf    = n=>window.open(`${BASE}/view-pdf/${n}`,"_blank");
  const activeTitle= chatList.find(c=>c.id===chatId)?.title;

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-head">
            <div className="brand">
              <div className="brand-icon"><IC.Bot/></div>
              <span className="brand-name">DocChat</span>
            </div>
            <button className="btn-new" onClick={newChat}><IC.Plus/><span>New Chat</span></button>
          </div>
          <div className="chat-list">
            {chatList.length===0
              ?<p className="empty-hint">No chats yet</p>
              :chatList.map(c=>(
                <ChatItem key={c.id} chat={c} active={chatId===c.id}
                  pdfs={chatId===c.id?chatPdfs:[]}
                  onLoad={loadChat} onDelete={deleteChat} onOpenPdf={openPdf}/>
              ))
            }
          </div>
          <div className="sidebar-foot">
            <button className="btn-clear" onClick={clearChat} disabled={!chatId}>
              <IC.Clear/><span>Clear Messages</span>
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <header className="topbar">
            <div className="topbar-left">
              <h1 className="topbar-title">{activeTitle||"New Conversation"}</h1>
              {chatPdfs.length>0&&(
                <span className="topbar-badge">{chatPdfs.length} PDF{chatPdfs.length!==1?"s":""} loaded</span>
              )}
            </div>
            {/* Mode toggle + Prompt buttons + TTS controls in topbar */}
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <ModeToggle mode={mode} onChange={setMode} />
              <PromptButtons
                onOpenSystem={()=>{ setEditSystem(systemPrompt); setShowSystemModal(true); }}
                systemActive={systemPrompt !== DEFAULT_SYSTEM}
              />
              <TTSControls
                ttsLang={ttsLang} setTtsLang={setTtsLang}
                ttsRate={ttsRate} setTtsRate={setTtsRate}
                speaking={speaking} onStop={stopTTS}
              />
            </div>
          </header>

          {/* System Prompt Modal */}
          {showSystemModal && (
            <PromptModal
              type="system"
              value={editSystem}
              onChange={setEditSystem}
              onClose={()=>setShowSystemModal(false)}
              onSave={()=>setSystemPrompt(editSystem)}
              onReset={()=>setEditSystem(DEFAULT_SYSTEM)}
            />
          )}

          <div className="msgs">
            {messages.length===0
              ?(
                <div className="empty-state">
                  <div className="empty-icon"><IC.Bot/></div>
                  <p className="empty-title">DocChat AI</p>
                  {mode==="chat"
                    ? <p className="empty-sub">Chat freely with AI — ask anything, no PDF needed</p>
                    : <p className="empty-sub">Upload PDFs · Ask questions · Listen to answers</p>
                  }
                  <div className="empty-features">
                    {mode==="chat" ? <>
                      <span className="feat-chip"><IC.ChatBubble/> Free AI Chat</span>
                      <span className="feat-chip"><IC.Prompt/> Custom System Prompt</span>
                      <span className="feat-chip"><IC.Volume/> Voice output (TTS)</span>
                    </> : <>
                      <span className="feat-chip"><IC.File/> Multi-PDF RAG</span>
                      <span className="feat-chip"><IC.Mic/> Voice input (STT)</span>
                      <span className="feat-chip"><IC.Volume/> Voice output (TTS)</span>
                    </>}
                  </div>
                  {mode==="chat" && (
                    <div className="mode-hint-box">
                      <IC.ChatBubble/>
                      <span>Chat mode active — type anything to start. Switch to <b>PDF RAG</b> to ask from documents.</span>
                    </div>
                  )}
                </div>
              )
              :messages.map((m,i)=><Bubble key={i} msg={m} onSpeak={speak} speaking={speaking}/>)
            }
            {/* live interim STT preview */}
            {listening&&interimText&&(
              <div className="stt-interim">
                <span className="stt-interim-dot"/>
                <span>{interimText}</span>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* listening indicator banner */}
          {listening&&(
            <div className="stt-banner">
              <span className="stt-banner-dot"/>
              <span>Listening… speak your question</span>
              <button className="stt-banner-stop" onClick={stopListening}><IC.Stop/> Stop</button>
            </div>
          )}

          <div className="input-row">
            <textarea ref={inputRef} className="input-box" value={question}
              onChange={e=>setQuestion(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleAsk();}}}
              placeholder={listening?"Listening… (or type here)":mode==="chat"?"Chat with AI… (Enter to send)":"Ask from your PDFs… (Enter to send)"}
              rows={1}
            />
            {/* STT mic button */}
            <STTButton
              listening={listening}
              supported={sttSupported}
              sttLang={sttLang}
              setSttLang={setSttLang}
              onStart={startListening}
              onStop={stopListening}
            />
            <button className="btn-send" onClick={handleAsk} disabled={loading||!question.trim()}>
              {loading?<Dots/>:<IC.Send/>}
            </button>
          </div>

          <UploadZone onUpload={handleUpload} uploading={uploading} fileStatuses={fileStatuses}/>
        </main>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════
   CSS — white + yellow/orange/blue gradient
══════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --white:#ffffff;--off-white:#fdfcf9;--light:#f6f3ec;--light2:#ece8de;
  --yellow:#f5b800;--orange:#f06500;--blue:#1a6aff;--blue-deep:#0040cc;
  --grad:linear-gradient(135deg,#f5b800 0%,#f06500 48%,#1a6aff 100%);
  --grad-soft:linear-gradient(135deg,rgba(245,184,0,0.13) 0%,rgba(240,101,0,0.10) 50%,rgba(26,106,255,0.13) 100%);
  --grad-text:linear-gradient(135deg,#e09000,#d05000,#1a6aff);
  --text:#18182e;--text-md:#50506a;--text-dim:#a0a0b8;
  --border:rgba(240,101,0,0.15);--border-blue:rgba(26,106,255,0.14);--border-gold:rgba(245,184,0,0.22);
  --serif:'Playfair Display',Georgia,serif;--sans:'Plus Jakarta Sans',system-ui,sans-serif;
  --radius:13px;
}
body{background:var(--off-white);color:var(--text);font-family:var(--sans);font-size:13.5px;-webkit-font-smoothing:antialiased;}
.ic{width:15px;height:15px;flex-shrink:0;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(240,101,0,0.2);border-radius:99px;}
.shell{display:flex;height:100vh;overflow:hidden;background:var(--off-white);}

/* sidebar */
.sidebar{width:260px;flex-shrink:0;display:flex;flex-direction:column;background:var(--white);border-right:1.5px solid var(--border-gold);box-shadow:3px 0 24px rgba(245,184,0,0.07);position:relative;z-index:10;}
.sidebar-head{padding:20px 14px 16px;border-bottom:1.5px solid var(--border-gold);background:linear-gradient(180deg,rgba(245,184,0,0.05) 0%,transparent 100%);}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.brand-icon{width:36px;height:36px;border-radius:11px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;box-shadow:0 4px 16px rgba(240,101,0,0.35);}
.brand-icon svg{width:19px;height:19px;}
.brand-name{font-family:var(--serif);font-size:20px;font-weight:600;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.btn-new{width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 14px;border-radius:var(--radius);background:var(--grad);color:#fff;border:none;font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s,box-shadow .2s;box-shadow:0 4px 18px rgba(240,101,0,0.32);}
.btn-new:hover{opacity:0.9;box-shadow:0 6px 24px rgba(240,101,0,0.42);}
.chat-list{flex:1;overflow-y:auto;padding:10px 8px;}
.chat-list::-webkit-scrollbar{width:3px;}
.empty-hint{color:var(--text-dim);text-align:center;margin-top:30px;font-size:12px;}
.chat-item{border-radius:var(--radius);padding:4px 6px;cursor:pointer;transition:background .12s;margin-bottom:3px;}
.chat-item:hover{background:rgba(245,184,0,0.08);}
.chat-item-active{background:var(--grad-soft)!important;border:1px solid rgba(240,101,0,0.22);}
.chat-item-inner{display:flex;align-items:center;gap:9px;padding:7px 5px;}
.chat-item-inner>svg{color:var(--text-dim);flex-shrink:0;}
.chat-item-text{flex:1;min-width:0;}
.chat-title{font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;}
.chat-meta{font-size:10px;color:var(--text-dim);margin-top:2px;}
.btn-icon{background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:var(--text-dim);display:flex;align-items:center;opacity:0;transition:opacity .15s,background .15s;}
.chat-item:hover .btn-icon{opacity:1;}
.btn-delete:hover{background:rgba(220,50,50,0.1);color:#d04040;}
.pdf-list{padding:4px 8px 8px 26px;display:flex;flex-direction:column;gap:3px;}
.pdf-link{background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:10.5px;font-family:var(--sans);text-align:left;padding:3px 0;transition:color .12s;color:var(--orange);}
.pdf-link:hover{color:var(--blue);}
.pdf-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}
.sidebar-foot{padding:12px 10px 16px;border-top:1.5px solid var(--border-gold);}
.btn-clear{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;border-radius:var(--radius);background:rgba(240,101,0,0.07);border:1px solid rgba(240,101,0,0.22);color:var(--orange);font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
.btn-clear:hover:not(:disabled){background:rgba(240,101,0,0.14);}
.btn-clear:disabled{opacity:0.3;cursor:not-allowed;}

/* main */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.topbar{flex-shrink:0;padding:12px 22px;border-bottom:1.5px solid var(--border-gold);background:var(--white);display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 16px rgba(245,184,0,0.08);gap:12px;}
.topbar-left{display:flex;align-items:center;gap:12px;min-width:0;}
.topbar-title{font-family:var(--serif);font-style:italic;font-size:19px;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.topbar-badge{font-size:10.5px;font-weight:600;padding:3px 11px;border-radius:99px;background:var(--grad);color:#fff;box-shadow:0 2px 10px rgba(240,101,0,0.25);flex-shrink:0;}
.topbar-hint{font-size:11.5px;color:var(--text-dim);}

/* TTS controls */
.tts-controls{display:flex;align-items:center;gap:6px;position:relative;flex-shrink:0;}

/* MODE TOGGLE */
.mode-toggle{display:flex;align-items:center;background:var(--light);border:1.5px solid var(--border-gold);border-radius:10px;padding:3px;gap:2px;}
.mode-btn{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:7px;border:none;background:none;color:var(--text-md);font-size:11.5px;font-family:var(--sans);font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap;}
.mode-btn:hover{color:var(--orange);}
.mode-btn-active{background:var(--grad)!important;color:#fff!important;box-shadow:0 2px 8px rgba(240,101,0,0.25);}
.mode-hint-box{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:var(--radius);background:rgba(26,106,255,0.06);border:1.5px solid rgba(26,106,255,0.18);color:var(--text-md);font-size:12.5px;max-width:420px;line-height:1.5;margin-top:4px;}
.mode-hint-box svg{flex-shrink:0;color:var(--blue);}
.tts-toggle-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:1.5px solid var(--border-gold);background:var(--light);color:var(--text-md);font-size:11.5px;font-family:var(--sans);font-weight:500;cursor:pointer;transition:all .15s;position:relative;}
.tts-toggle-btn:hover{border-color:var(--orange);color:var(--orange);}
.tts-toggle-active{border-color:var(--orange)!important;background:rgba(240,101,0,0.08)!important;color:var(--orange)!important;}
.tts-live-dot{width:7px;height:7px;border-radius:50%;background:var(--orange);position:absolute;top:-3px;right:-3px;animation:dotBounce 1s ease-in-out infinite;}
.tts-stop-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:none;background:rgba(240,101,0,0.1);color:var(--orange);font-size:11.5px;font-family:var(--sans);font-weight:600;cursor:pointer;transition:all .15s;}
.tts-stop-btn:hover{background:rgba(240,101,0,0.2);}
.tts-panel{position:absolute;top:calc(100% + 8px);right:0;background:var(--white);border:1.5px solid var(--border-gold);border-radius:var(--radius);padding:14px 16px;min-width:220px;z-index:200;box-shadow:0 8px 30px rgba(240,101,0,0.12);display:flex;flex-direction:column;gap:12px;}
.tts-panel-row{display:flex;flex-direction:column;gap:5px;}
.tts-label{font-size:11px;font-weight:600;color:var(--text-md);letter-spacing:0.04em;text-transform:uppercase;}
.tts-select{padding:7px 10px;border-radius:8px;border:1.5px solid var(--border-gold);background:var(--light);font-family:var(--sans);font-size:12.5px;color:var(--text);outline:none;cursor:pointer;}
.tts-select:focus{border-color:var(--orange);}
.tts-range{width:100%;accent-color:var(--orange);}

/* STT */
.stt-wrap{display:flex;align-items:center;gap:4px;position:relative;}
.btn-mic{display:flex;align-items:center;gap:5px;padding:0 12px;height:44px;border-radius:var(--radius);border:1.5px solid var(--border-gold);background:var(--light);color:var(--text-md);font-size:12px;font-family:var(--sans);font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap;}
.btn-mic:hover{border-color:var(--orange);color:var(--orange);background:rgba(240,101,0,0.06);}
.btn-mic-active{background:rgba(240,101,0,0.1)!important;border-color:var(--orange)!important;color:var(--orange)!important;animation:micPulse 1.5s ease-in-out infinite;}
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(240,101,0,0.3);}50%{box-shadow:0 0 0 6px rgba(240,101,0,0);}}
.btn-mic-lang{width:30px;height:30px;border-radius:8px;border:1px solid var(--border-gold);background:var(--light);color:var(--text-dim);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0;}
.btn-mic-lang:hover{border-color:var(--blue);color:var(--blue);}
.stt-lang-panel{position:absolute;bottom:calc(100% + 8px);right:0;background:var(--white);border:1.5px solid var(--border-gold);border-radius:var(--radius);padding:12px;z-index:200;box-shadow:0 8px 30px rgba(240,101,0,0.12);min-width:180px;max-height:240px;overflow-y:auto;}
.stt-lang-opt{display:block;width:100%;text-align:left;padding:6px 10px;border:none;border-radius:7px;background:none;font-family:var(--sans);font-size:12.5px;color:var(--text-md);cursor:pointer;transition:all .12s;}
.stt-lang-opt:hover{background:rgba(245,184,0,0.1);color:var(--text);}
.stt-lang-active{background:var(--grad-soft)!important;color:var(--orange)!important;font-weight:600;}

/* STT banner */
.stt-banner{display:flex;align-items:center;gap:10px;padding:8px 22px;background:rgba(240,101,0,0.07);border-top:1px solid rgba(240,101,0,0.15);border-bottom:1px solid rgba(240,101,0,0.15);font-size:12.5px;color:var(--orange);font-weight:500;flex-shrink:0;}
.stt-banner-dot{width:8px;height:8px;border-radius:50%;background:var(--orange);flex-shrink:0;animation:micPulse 1.2s ease-in-out infinite;}
.stt-banner-stop{margin-left:auto;display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:7px;border:1px solid rgba(240,101,0,0.3);background:rgba(240,101,0,0.1);color:var(--orange);font-size:12px;font-family:var(--sans);font-weight:600;cursor:pointer;transition:all .15s;}
.stt-banner-stop:hover{background:rgba(240,101,0,0.2);}

/* STT interim live text */
.stt-interim{display:flex;align-items:center;gap:8px;padding:8px 14px;margin:0 0 10px;border-radius:var(--radius);background:rgba(245,184,0,0.08);border:1px dashed rgba(240,101,0,0.3);color:var(--orange);font-size:13px;font-style:italic;align-self:flex-start;max-width:70%;}
.stt-interim-dot{width:7px;height:7px;border-radius:50%;background:var(--orange);flex-shrink:0;animation:dotBounce 1s ease-in-out infinite;}

/* messages */
.msgs{flex:1;overflow-y:auto;padding:28px 28px;display:flex;flex-direction:column;background:radial-gradient(ellipse 55% 35% at 15% 8%,rgba(245,184,0,0.08) 0%,transparent 65%),radial-gradient(ellipse 45% 30% at 85% 92%,rgba(26,106,255,0.07) 0%,transparent 65%),var(--off-white);}
.empty-state{margin:auto;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;}
.empty-icon{width:64px;height:64px;border-radius:20px;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 36px rgba(240,101,0,0.32);}
.empty-icon svg{width:30px;height:30px;}
.empty-title{font-family:var(--serif);font-size:28px;font-style:italic;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.empty-sub{font-size:13.5px;color:var(--text-md);max-width:350px;line-height:1.65;}
.empty-features{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px;}
.feat-chip{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-md);background:var(--white);border:1.5px solid var(--border-gold);padding:5px 12px;border-radius:99px;font-weight:500;}
.feat-chip svg{width:12px;height:12px;}

.bubble-row{display:flex;align-items:flex-end;gap:10px;margin-bottom:18px;}
.bubble-right{flex-direction:row-reverse;}
.bubble-left{flex-direction:row;}
.avatar{width:32px;height:32px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;}
.avatar-bot{background:var(--grad);color:#fff;box-shadow:0 3px 12px rgba(240,101,0,0.28);}
.avatar-bot svg{width:17px;height:17px;}
.avatar-user{background:rgba(26,106,255,0.12);color:var(--blue);border:1.5px solid rgba(26,106,255,0.28);}
.bubble{max-width:68%;padding:12px 16px;border-radius:16px;font-size:13.5px;line-height:1.7;white-space:pre-wrap;word-break:break-word;}
.bubble-user{background:rgba(26,106,255,0.08);border:1.5px solid rgba(26,106,255,0.18);border-bottom-right-radius:4px;color:var(--blue-deep);}
.bubble-ai{background:var(--white);border:1.5px solid var(--border-gold);border-bottom-left-radius:4px;color:var(--text);box-shadow:0 2px 14px rgba(245,184,0,0.08);}

/* speak button */
.speak-btn{width:30px;height:30px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(240,101,0,0.08);border:1px solid rgba(240,101,0,0.22);color:var(--orange);cursor:pointer;transition:all .15s;align-self:flex-end;margin-bottom:2px;}
.speak-btn:hover{background:rgba(240,101,0,0.16);box-shadow:0 3px 10px rgba(240,101,0,0.2);}
.speak-btn-active{background:rgba(240,101,0,0.18)!important;box-shadow:0 0 0 3px rgba(240,101,0,0.15)!important;}

/* dots */
.dots-wrap{display:inline-flex;gap:4px;align-items:center;padding:2px 0;}
.dot{width:6px;height:6px;border-radius:50%;background:var(--orange);opacity:0.8;animation:dotBounce 1.1s ease-in-out infinite;}
@keyframes dotBounce{0%,80%,100%{transform:translateY(0);opacity:0.35;}40%{transform:translateY(-5px);opacity:1;}}

/* input */
.input-row{flex-shrink:0;display:flex;align-items:flex-end;gap:8px;padding:12px 22px 10px;border-top:1.5px solid var(--border-gold);background:var(--white);box-shadow:0 -2px 14px rgba(245,184,0,0.06);}
.input-box{flex:1;resize:none;min-height:44px;max-height:130px;background:var(--light);border:1.5px solid var(--border-gold);border-radius:var(--radius);padding:12px 14px;color:var(--text);font-size:13.5px;font-family:var(--sans);outline:none;transition:border-color .2s,box-shadow .2s;overflow-y:auto;}
.input-box::placeholder{color:var(--text-dim);}
.input-box:focus{border-color:var(--orange);box-shadow:0 0 0 3px rgba(240,101,0,0.09);}
.btn-send{width:44px;height:44px;flex-shrink:0;border-radius:var(--radius);border:none;background:var(--grad);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s,transform .12s,box-shadow .2s;box-shadow:0 4px 16px rgba(240,101,0,0.38);}
.btn-send:hover:not(:disabled){opacity:0.9;box-shadow:0 6px 22px rgba(240,101,0,0.48);}
.btn-send:active:not(:disabled){transform:scale(0.92);}
.btn-send:disabled{opacity:0.28;cursor:not-allowed;box-shadow:none;}
.btn-send svg{width:16px;height:16px;}

/* upload */
.upload-zone{flex-shrink:0;display:flex;flex-direction:column;gap:8px;padding:10px 22px 14px;background:var(--white);border-top:1.5px solid var(--border-blue);}
.upload-controls{display:flex;align-items:center;gap:10px;}
.drop-area{flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:var(--radius);cursor:pointer;border:1.5px dashed rgba(240,101,0,0.28);color:var(--text-dim);font-size:12.5px;background:var(--light);transition:all .2s;overflow:hidden;}
.drop-area span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.drop-area:hover,.drop-area.drop-active{border-color:var(--orange);background:rgba(245,184,0,0.08);color:var(--orange);}
.drop-area.drop-has-file{border-color:var(--blue);border-style:solid;background:rgba(26,106,255,0.06);color:var(--blue);}
.btn-upload{display:flex;align-items:center;gap:7px;padding:10px 20px;border-radius:var(--radius);border:none;background:var(--grad);color:#fff;font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;flex-shrink:0;white-space:nowrap;box-shadow:0 4px 16px rgba(240,101,0,0.3);}
.btn-upload:hover:not(:disabled){opacity:0.9;box-shadow:0 6px 22px rgba(240,101,0,0.42);}
.btn-upload:active:not(:disabled){transform:scale(0.97);}
.btn-upload:disabled{opacity:0.33;cursor:not-allowed;box-shadow:none;}
.file-queue{display:flex;flex-wrap:wrap;gap:6px;}
.file-pill{display:flex;align-items:center;gap:6px;padding:5px 11px;border-radius:8px;border:1px solid;font-size:11.5px;font-family:var(--sans);max-width:260px;}
.pill-pending{background:var(--light);border-color:rgba(0,0,0,0.1);color:var(--text-md);}
.pill-uploading{background:rgba(245,184,0,0.1);border-color:rgba(245,184,0,0.4);color:var(--orange);}
.pill-done{background:rgba(26,106,255,0.08);border-color:rgba(26,106,255,0.28);color:var(--blue);}
.pill-error{background:rgba(210,50,50,0.07);border-color:rgba(210,50,50,0.24);color:#c03030;}
.file-pill-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
.file-pill-size{flex-shrink:0;opacity:0.55;}
.pill-remove{background:none;border:none;cursor:pointer;display:flex;align-items:center;color:var(--text-dim);padding:0;margin-left:2px;transition:color .12s;}
.pill-remove:hover{color:#c03030;}

/* ── PROMPT BUTTONS ── */
.prompt-btns{display:flex;align-items:center;gap:5px;}
.prompt-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:1.5px solid var(--border-gold);background:var(--light);color:var(--text-md);font-size:11.5px;font-family:var(--sans);font-weight:500;cursor:pointer;transition:all .15s;position:relative;white-space:nowrap;}
.prompt-btn:hover{border-color:var(--orange);color:var(--orange);background:rgba(240,101,0,0.05);}
.prompt-btn-active{border-color:var(--orange)!important;background:rgba(240,101,0,0.08)!important;color:var(--orange)!important;}
.prompt-dot{width:6px;height:6px;border-radius:50%;background:var(--orange);position:absolute;top:-3px;right:-3px;}

/* ── MODAL ── */
.modal-overlay{position:fixed;inset:0;background:rgba(24,24,46,0.45);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal-box{background:var(--white);border:1.5px solid var(--border-gold);border-radius:18px;width:100%;max-width:560px;box-shadow:0 20px 60px rgba(240,101,0,0.15),0 4px 20px rgba(0,0,0,0.1);display:flex;flex-direction:column;gap:0;overflow:hidden;}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;border-bottom:1.5px solid var(--border-gold);}
.modal-title-row{display:flex;align-items:center;gap:8px;}
.modal-title{font-family:var(--serif);font-size:19px;font-style:italic;background:var(--grad-text);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.modal-close{width:30px;height:30px;border-radius:8px;border:1px solid var(--border-gold);background:var(--light);color:var(--text-dim);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
.modal-close:hover{border-color:var(--orange);color:var(--orange);}
.modal-desc{padding:12px 20px 8px;font-size:12.5px;color:var(--text-md);line-height:1.6;}
.modal-textarea{margin:0 20px;border:1.5px solid var(--border-gold);border-radius:var(--radius);padding:12px 14px;font-family:var(--sans);font-size:13px;color:var(--text);background:var(--light);resize:vertical;outline:none;transition:border-color .2s,box-shadow .2s;min-height:160px;}
.modal-textarea:focus{border-color:var(--orange);box-shadow:0 0 0 3px rgba(240,101,0,0.08);}
.modal-textarea::placeholder{color:var(--text-dim);}
.modal-footer{display:flex;align-items:center;justify-content:space-between;padding:14px 20px 18px;}
.modal-btn-reset{background:none;border:none;font-family:var(--sans);font-size:12px;color:var(--text-dim);cursor:pointer;text-decoration:underline;transition:color .12s;}
.modal-btn-reset:hover{color:var(--orange);}
.modal-btn-cancel{padding:8px 16px;border-radius:var(--radius);border:1.5px solid var(--border-gold);background:var(--light);font-family:var(--sans);font-size:12.5px;color:var(--text-md);cursor:pointer;transition:all .15s;}
.modal-btn-cancel:hover{border-color:var(--orange);color:var(--orange);}
.modal-btn-save{display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:var(--radius);border:none;background:var(--grad);color:#fff;font-family:var(--sans);font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;box-shadow:0 3px 12px rgba(240,101,0,0.28);}
.modal-btn-save:hover{opacity:0.9;box-shadow:0 5px 16px rgba(240,101,0,0.38);}
`;
