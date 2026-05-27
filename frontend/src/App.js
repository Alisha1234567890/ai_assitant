import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { BASE, DEFAULT_SYSTEM } from "./constants";
import { useAuth } from "./context/AuthContext";
import { AUTH_CSS } from "./styles/authStyles";
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
import ExportDropdown from "./components/chat/ExportDropdown";
import { getLastQAPair } from "./utils/getLastQAPair";
import { exportToPDF, exportSummaryToPDF, exportToMarkdown, exportToText } from "./utils/exportUtils";

export default function App() {
  const { user, logout } = useAuth();
  const userId = user.id;
  const userInitial = (user.name || user.email || "?")[0].toUpperCase();

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

  const [showKnowledgeMap, setShowKnowledgeMap] = useState(false);
  const [knowledgeGraph, setKnowledgeGraph] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [mapQuestion, setMapQuestion] = useState(null);
  const [chatKnowledgeMaps, setChatKnowledgeMaps] = useState([]);
  const [graphFromCache, setGraphFromCache] = useState(false);
  const [graphMode, setGraphMode] = useState("pdf");
  const [initialGraphFilter, setInitialGraphFilter] = useState("all");
  const [lastQuestion, setLastQuestion] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

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

  useEffect(()=>{ fetchChats(); },[userId]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const fetchChats = async () => {
    try { const r=await axios.get(`${BASE}/chats/${userId}`); setChatList(r.data.chats||[]); } catch{}
  };

  const loadChat = useCallback(async(id)=>{
    setChatId(id);
    try {
      const r=await axios.get(`${BASE}/chat/${id}`);
      setMessages((r.data.messages||[]).map(m=>({type:m.role,text:m.text})));
      setChatPdfs(r.data.pdfMeta || r.data.pdfs || []);
      setChatKnowledgeMaps(r.data.knowledgeMaps||[]);
      setKnowledgeGraph(null);
      setMapQuestion(null);
      setGraphFromCache(false);
    } catch(e){console.error(e);}
  },[]);

  const newChat = ()=>{
    setChatId(null);setMessages([]);setQuestion("");setChatPdfs([]);setFileStatuses({});
    setShowKnowledgeMap(false);setKnowledgeGraph(null);setMapQuestion(null);
    setChatKnowledgeMaps([]);
    setGraphFromCache(false);
    setLastQuestion(null);setLastAnswer(null);setGraphError(null);
  };

  const upsertLocalKnowledgeMap = useCallback((data, question) => {
    const entry = {
      id: data.mapId,
      question: question.trim(),
      answer: (data.answer || "").slice(0, 2000),
      nodes: data.nodes,
      edges: data.edges || [],
      centerId: data.centerId,
      createdAt: new Date().toISOString(),
    };
    setChatKnowledgeMaps((prev) => {
      const q = question.trim();
      const rest = prev.filter((m) => (m.question || "").trim() !== q);
      return [...rest, entry];
    });
  }, []);

  const fetchPdfGraph = useCallback(async (regenerate = false) => {
    if (!chatId) return;
    setGraphLoading(true);
    setGraphError(null);
    setGraphMode("pdf");
    setMapQuestion(null);
    setGraphFromCache(false);
    try {
      if (regenerate) {
        await axios.post(`${BASE}/graph/build`, { chatId, force: true });
      }
      const r = await axios.get(`${BASE}/graph/${chatId}`);
      if (r.data?.error) {
        setGraphError(r.data.error);
        setKnowledgeGraph(null);
      } else if (r.data?.nodes?.length) {
        setKnowledgeGraph(r.data);
        setGraphFromCache(!!r.data.layoutComputed);
      } else {
        setGraphError("No graph yet — upload PDFs to build your knowledge network.");
        setKnowledgeGraph(null);
      }
    } catch {
      setGraphError("Failed to load knowledge graph. Is the AI service running?");
      setKnowledgeGraph(null);
    }
    setGraphLoading(false);
  }, [chatId]);

  const fetchKnowledgeMap = useCallback(async (question, answer, regenerate = false) => {
    setGraphMode("qa");
    if (!question?.trim()) return;
    setGraphLoading(true);
    setGraphError(null);
    setMapQuestion(question);
    setGraphFromCache(false);

    if (!regenerate) {
      const q = question.trim();
      const local = chatKnowledgeMaps.find(
        (m) => (m.question || "").trim() === q && m.nodes?.length
      );
      if (local) {
        setKnowledgeGraph({
          nodes: local.nodes,
          edges: local.edges || [],
          centerId: local.centerId,
          mapId: local.id,
          fromCache: true,
          saved: true,
        });
        setGraphFromCache(true);
        setGraphLoading(false);
        return;
      }
    }

    try {
      const r = await axios.post(`${BASE}/knowledge-map`, {
        question,
        answer: answer || undefined,
        chatId,
        userId,
        mode,
        regenerate,
      });
      if (r.data?.nodes?.length) {
        setKnowledgeGraph(r.data);
        setGraphFromCache(!!r.data.fromCache);
        if (r.data.saved && chatId) upsertLocalKnowledgeMap(r.data, question);
      } else {
        setGraphError("Could not build knowledge map.");
        setKnowledgeGraph(null);
      }
    } catch {
      setGraphError("Failed to load knowledge map. Is the AI service running?");
      setKnowledgeGraph(null);
    }
    setGraphLoading(false);
  }, [chatId, mode, userId, chatKnowledgeMaps, upsertLocalKnowledgeMap]);

  const toggleKnowledgeMap = useCallback(() => {
    if (showKnowledgeMap) {
      setShowKnowledgeMap(false);
      return;
    }
    setShowKnowledgeMap(true);
    if (chatPdfs.length > 0 && chatId) {
      fetchPdfGraph(false);
      return;
    }
    const q = lastQuestion || getLastQAPair(messages).question;
    const a = lastAnswer || getLastQAPair(messages).answer;
    if (!q) {
      alert("Upload PDFs or ask a question first, then open the knowledge graph.");
      setShowKnowledgeMap(false);
      return;
    }
    fetchKnowledgeMap(q, a, false);
  }, [
    showKnowledgeMap,
    chatPdfs.length,
    chatId,
    lastQuestion,
    lastAnswer,
    messages,
    fetchPdfGraph,
    fetchKnowledgeMap,
  ]);

  const canOpenGraph = Boolean(
    (chatId && chatPdfs.length > 0) ||
    lastQuestion ||
    getLastQAPair(messages).question
  );

  const handleUpload = async(files,clearFiles)=>{
    setUploading(true);
    const init={};files.forEach(f=>{init[f.name]="uploading";});setFileStatuses(init);
    const fd=new FormData();
    files.forEach(f=>fd.append("files",f));
    fd.append("chatId",chatId??"null"); fd.append("userId",userId);
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
        if (r.data.graph?.nodes?.length) {
          setKnowledgeGraph(r.data.graph);
          setGraphFromCache(!!r.data.graph.layoutComputed);
          setGraphMode("pdf");
          if (up.length > 0) {
            setInitialGraphFilter(up[up.length - 1].name);
          }
          setShowKnowledgeMap(true); // Automatically open graph after upload
        }

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
        userId,
        systemPrompt: systemPrompt.trim() || undefined,
        mode,
      });
      const answer=r?.data?.answer??"⚠️ No response";
      if(r?.data?.chatId){setChatId(r.data.chatId);fetchChats();}
      setMessages(prev=>{const u=[...prev];u[u.length-1]={type:"bot",text:""};return u;});
      setLastQuestion(q);
      setLastAnswer(answer);
      await typeText(answer,typed=>{
        setMessages(prev=>{const u=[...prev];u[u.length-1]={type:"bot",text:typed};return u;});
      });
      setLastAnswer(answer);

      // Automatically generate and show Q&A knowledge map
      if (mode !== "chat") {
        setInitialGraphFilter("all"); // Reset filter for Q&A map
        setShowKnowledgeMap(true);
        fetchKnowledgeMap(q, answer, false);
      }

    } catch {

      setMessages(prev=>{const u=[...prev];u[u.length-1]={type:"bot",text:"❌ Failed to get response."};return u;});
    }
    setLoading(false); inputRef.current?.focus();
  };

  const handleExport = async (format) => {
    if (!messages.length) return alert("No messages to export!");
    const title = activeTitle || "New Conversation";

    if (format === "pdf") {
      exportToPDF(title, messages, user);
    } else if (format === "md") {
      exportToMarkdown(title, messages);
    } else if (format === "txt") {
      exportToText(title, messages);
    } else if (format === "summary") {
      if (!chatId) return alert("Save the chat first to generate a summary!");
      setLoadingSummary(true);
      try {
        const r = await axios.post(`${BASE}/chat/summary`, { chatId, userId });
        if (r.data?.summary) {
          exportSummaryToPDF(r.data.summary, title, user);
        } else {
          alert("Could not generate summary.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to generate summary report.");
      }
      setLoadingSummary(false);
    }
  };

  const clearChat  = async()=>{
    if(!chatId)return;
    await axios.delete(`${BASE}/chat/${chatId}`).catch(()=>{});
    setMessages([]);
    setChatKnowledgeMaps([]);
    setKnowledgeGraph(null);
    setMapQuestion(null);
    setGraphFromCache(false);
  };
  const deleteChat = async(e,id)=>{ e.stopPropagation(); if(!window.confirm("Delete this chat?"))return; await axios.delete(`${BASE}/delete/${id}`).catch(()=>{}); if(chatId===id)newChat(); fetchChats(); };
  const openPdf    = n=>window.open(`${BASE}/view-pdf/${n}`,"_blank");
  const activeTitle= chatList.find(c=>c.id===chatId)?.title;

  return (
    <>
      <style>{CSS}{AUTH_CSS}</style>
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
            <div className="sidebar-user">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button type="button" className="btn-logout" onClick={logout}>
              Sign out
            </button>
            <button className="btn-clear" onClick={clearChat} disabled={!chatId}>
              <IC.Clear/><span>Clear Messages</span>
            </button>
          </div>
        </aside>

        <main className={`main ${showKnowledgeMap ? "main-split" : ""}`}>
          <header className="topbar">
            <div className="topbar-left">
              <h1 className="topbar-title">{activeTitle||"New Conversation"}</h1>
              {chatPdfs.length>0&&(
                <span className="topbar-badge">{chatPdfs.length} Document{chatPdfs.length!==1?"s":""} loaded</span>
              )}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <ExportDropdown onExport={handleExport} loadingSummary={loadingSummary} />
              <ModeToggle mode={mode} onChange={setMode} />
              <div className="prompt-btns">
                <PromptButtons
                  onOpenSystem={()=>{ setEditSystem(systemPrompt); setShowSystemModal(true); }}
                  systemActive={systemPrompt !== DEFAULT_SYSTEM}
                />
                <GraphButton
                  active={showKnowledgeMap}
                  disabled={!canOpenGraph}
                  onClick={toggleKnowledgeMap}
                />
              </div>
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

          <div className="main-body">
          <div className="chat-pane">

          <div className="msgs">
            {messages.length===0
              ?(
                <div className="empty-state">
                  <div className="empty-icon"><IC.Bot/></div>
                  <p className="empty-title">DocChat AI</p>
                  {mode==="chat"
                    ? <p className="empty-sub">Chat freely with AI — ask anything, no documents needed</p>
                    : <p className="empty-sub">Upload documents · Ask questions · Listen to answers</p>
                  }
                  <div className="empty-features">
                    {mode==="chat" ? <>
                      <span className="feat-chip"><IC.ChatBubble/> Free AI Chat</span>
                      <span className="feat-chip"><IC.Prompt/> Custom System Prompt</span>
                      <span className="feat-chip"><IC.Volume/> Voice output (TTS)</span>
                    </> : <>
                      <span className="feat-chip"><IC.File/> Multi-Format RAG</span>
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
              :messages.map((m,i)=><Bubble key={i} msg={m} onSpeak={speak} speaking={speaking} userInitial={userInitial}/>)
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

          </div>

          {showKnowledgeMap && (
            <KnowledgeMapPanel
              graph={knowledgeGraph}
              loading={graphLoading}
              error={graphError}
              chatId={chatId}
              graphMode={graphMode}
              initialFilter={initialGraphFilter}
              fromCache={graphFromCache}
              onClose={() => setShowKnowledgeMap(false)}

              onRefresh={() => {
                if (graphMode === "pdf" && chatId) {
                  fetchPdfGraph(true);
                  return;
                }
                const q = mapQuestion || lastQuestion || getLastQAPair(messages).question;
                const a = lastAnswer || getLastQAPair(messages).answer;
                if (q) fetchKnowledgeMap(q, a, true);
              }}
            />
          )}

          </div>
        </main>
      </div>
    </>
  );
}
