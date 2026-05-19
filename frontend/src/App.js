import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { BASE, USER_ID, DEFAULT_SYSTEM } from "./constants";
import { typeText } from "./utils/typeText";
import { CSS } from "./styles/appStyles";
import { IC } from "./icons/Icons";
import { useTTS } from "./hooks/useTTS";
import { useSTT } from "./hooks/useSTT";
import Dots from "./components/common/Dots";
import TTSControls from "./components/speech/TTSControls";
import STTButton from "./components/speech/STTButton";
import PromptModal from "./components/prompts/PromptModal";
import ModeToggle from "./components/chat/ModeToggle";
import PromptButtons from "./components/chat/PromptButtons";
import Bubble from "./components/chat/Bubble";
import ChatItem from "./components/chat/ChatItem";
import UploadZone from "./components/upload/UploadZone";
import GraphButton from "./components/knowledge/GraphButton";
import KnowledgeMapPanel from "./components/knowledge/KnowledgeMapPanel";

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
  const [interimText,  setInterimText]  = useState("");

  const [systemPrompt,     setSystemPrompt]     = useState(DEFAULT_SYSTEM);
  const [showSystemModal,  setShowSystemModal]  = useState(false);
  const [editSystem,       setEditSystem]       = useState(DEFAULT_SYSTEM);
  const [mode, setMode] = useState("rag");
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [knowledgeGraph, setKnowledgeGraph] = useState({
    nodes: [],
    edges: [],
  });
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const bottomRef = useRef();
  const inputRef  = useRef();

  const { speak, stop: stopTTS, speaking, ttsLang, setTtsLang, ttsRate, setTtsRate } = useTTS();

  const { listening, supported: sttSupported, startListening, stopListening } = useSTT({
    sttLang,
    onInterim: (text) => {
      setInterimText(text);
      setQuestion(prev => {
        const base = prev.replace(/\[listening….*?\]$/, "").trimEnd();
        return base ? base + " " + text : text;
      });
    },
    onResult: (text) => {
      setInterimText("");
      setQuestion(prev => {
        const base = prev.replace(/\[listening….*?\]$/, "").trimEnd();
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

  const newChat = ()=>{
    setChatId(null);setMessages([]);setQuestion("");setChatPdfs([]);
    setFileStatuses({});
    setShowKnowledge(false);setKnowledgeGraph(null);setKnowledgeError("");
    setLastQuestion("");
  };

  const fetchKnowledgeGraph = useCallback(async (q, answer) => {
    const question = (q || "").trim();
    const ans = (answer || "").trim();
  
    if (
      !question ||
      !ans ||
      ans.startsWith("❌") ||
      ans.startsWith("⚠️")
    ) {
      return;
    }
  
    setKnowledgeLoading(true);
    setKnowledgeError("");
    setLastQuestion(question);
  
    try {
      const r = await axios.post(
        `${BASE}/knowledge-map`,
        {
          question,
          answer: ans,
          chatId,
          mode,
        }
      );
  
      const safeGraph = {
        nodes: Array.isArray(r.data?.graph?.nodes)
          ? r.data.graph.nodes
          : [],
        edges: Array.isArray(r.data?.graph?.edges)
          ? r.data.graph.edges
          : [],
      };
  
      setKnowledgeGraph(safeGraph);
  
      if (
        safeGraph.nodes.length > 0 ||
        safeGraph.edges.length > 0
      ) {
        setShowKnowledge(true);
      }
    } catch (err) {
      console.error(err);
  
      setKnowledgeError(
        "Could not build knowledge map. Is the backend running?"
      );
  
      setKnowledgeGraph({
        nodes: [],
        edges: [],
      });
    }
  
    setKnowledgeLoading(false);
  }, [chatId, mode]);

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
      fetchKnowledgeGraph(q, answer);
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

        <div className="main-col">
        <main className="main">
          <header className="topbar">
            <div className="topbar-left">
              <h1 className="topbar-title">{activeTitle||"New Conversation"}</h1>
              {chatPdfs.length>0&&(
                <span className="topbar-badge">{chatPdfs.length} PDF{chatPdfs.length!==1?"s":""} loaded</span>
              )}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <ModeToggle mode={mode} onChange={setMode} />
              <GraphButton
                active={showKnowledge}
                disabled={!lastQuestion && !knowledgeGraph}
                onClick={()=>setShowKnowledge(v=>!v)}
              />
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
            {listening&&interimText&&(
              <div className="stt-interim">
                <span className="stt-interim-dot"/>
                <span>{interimText}</span>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

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

        {showKnowledge && (
          <KnowledgeMapPanel
            graph={knowledgeGraph}
            loading={knowledgeLoading}
            error={knowledgeError}
            question={lastQuestion}
            onClose={()=>setShowKnowledge(false)}
            onRefresh={()=>{
              const lastBot = [...messages].reverse().find(m=>m.type==="bot"&&!m.typing);
              if (lastQuestion && lastBot?.text) fetchKnowledgeGraph(lastQuestion, lastBot.text);
            }}
          />
        )}
        </div>
      </div>
    </>
  );
}
