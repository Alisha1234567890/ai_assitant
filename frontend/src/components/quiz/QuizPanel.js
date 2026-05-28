import React, { useState, useEffect } from "react";
import axios from "axios";
import { BASE } from "../../constants";
import { IC } from "../../icons/Icons";

export default function QuizPanel({ chatId, userId, chatPdfs, onGenerate }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("generate"); // "generate" or "history"
  const [history, setHistory] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState(["mcq", "true_false", "fill_blank"]);

  useEffect(() => {
    if (chatId) {
      fetchTopics();
      fetchHistory();
    }
    // Default to all files selected if not already
    if (chatPdfs && chatPdfs.length > 0 && selectedFiles.length === 0) {
      setSelectedFiles(chatPdfs.map(p => typeof p === 'string' ? p : p.name));
    }
  }, [chatId, chatPdfs]);

  const fetchTopics = async () => {
    try {
      const r = await axios.get(`${BASE}/quiz/topics/${chatId}`);
      setTopics(r.data.topics || []);
    } catch (e) {
      console.error("Failed to fetch topics", e);
    }
  };

  const fetchHistory = async () => {
    try {
      const r = await axios.get(`${BASE}/quiz/history/${chatId}`);
      setHistory(r.data.history || []);
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const r = await axios.post(`${BASE}/quiz/generate`, {
        chatId,
        userId,
        difficulty,
        topic: selectedTopic,
        pdfNames: selectedFiles,
        count,
        types
      });
      
      if (r.data?.success === false) {
        alert(`Quiz Generation Error: ${r.data.error}\n\n${r.data.details || ""}`);
        return;
      }
      
      onGenerate(r.data);
    } catch (e) {
      console.error("Quiz generate error:", e);
      alert(e.response?.data?.detail || "Failed to generate quiz");
    } finally {
      setLoading(false);
    }
  };

  const toggleType = (t) => {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const toggleFile = (fileName) => {
    setSelectedFiles(prev => 
      prev.includes(fileName) 
        ? prev.filter(f => f !== fileName) 
        : [...prev, fileName]
    );
  };

  return (
    <div className="quiz-panel">
      <div className="quiz-tabs">
        <button 
          className={`tab-btn ${activeTab === "generate" ? "active" : ""}`}
          onClick={() => setActiveTab("generate")}
        >
          <IC.Quiz /> New Quiz
        </button>
        <button 
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <IC.Refresh /> History
        </button>
      </div>

      {activeTab === "generate" ? (
        <div className="tab-content">
          <div className="quiz-panel-header">
            <IC.Brain />
            <h3>AI Quiz Generator</h3>
          </div>
          
          <div className="quiz-field">
            <label>Select Documents</label>
            <div className="file-selection-list">
              {chatPdfs && chatPdfs.map((p, i) => {
                const name = typeof p === 'string' ? p : p.name;
                const isSelected = selectedFiles.includes(name);
                return (
                  <div 
                    key={i} 
                    className={`file-select-item ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleFile(name)}
                  >
                    <div className="checkbox">
                      {isSelected && <IC.Check />}
                    </div>
                    <span className="file-name-small">{name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="quiz-field">
            <label>Difficulty</label>
            <div className="difficulty-toggle">
              {["easy", "medium", "hard"].map(d => (
                <button 
                  key={d} 
                  className={`diff-btn ${difficulty === d ? "active" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="quiz-field">
            <label>Focus Topic (Optional)</label>
            <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}>
              <option value="">General (All documents)</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="quiz-field">
            <label>Questions: {count}</label>
            <input 
              type="range" min="3" max="15" 
              value={count} 
              onChange={e => setCount(parseInt(e.target.value))} 
            />
          </div>

          <div className="quiz-field">
            <label>Question Types</label>
            <div className="type-chips">
              {[
                { id: "mcq", label: "Multiple Choice" },
                { id: "true_false", label: "True / False" },
                { id: "fill_blank", label: "Fill in Blanks" }
              ].map(t => (
                <button 
                  key={t.id} 
                  className={`type-chip ${types.includes(t.id) ? "active" : ""}`}
                  onClick={() => toggleType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button 
            className="btn-generate-quiz" 
            onClick={handleGenerate} 
            disabled={loading || types.length === 0}
          >
            {loading ? <div className="spinner-tiny" /> : <><IC.Quiz /> Generate Quiz</>}
          </button>
        </div>
      ) : (
        <div className="tab-content history-tab">
          <div className="quiz-panel-header">
            <IC.Award />
            <h3>Recent Quiz Scores</h3>
          </div>
          
          {history.length === 0 ? (
            <div className="empty-history">
              <p>No quizzes completed yet in this chat.</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((h, i) => (
                <div key={i} className="history-item">
                  <div className="history-item-top">
                    <span className={`diff-tag ${h.difficulty}`}>{h.difficulty}</span>
                    <span className="history-date">
                      {new Date(h.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="history-title">{h.quizTitle}</div>
                  <div className="history-score-bar">
                    <div className="score-text">Score: <strong>{h.score}</strong> / {h.total}</div>
                    <div className="score-percent">({Math.round((h.score/h.total)*100)}%)</div>
                  </div>
                  <div className="progress-bar-tiny">
                    <div className="progress-fill-tiny" style={{ width: `${(h.score/h.total)*100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .quiz-panel {
          padding: 0;
          background: var(--white);
          border-radius: 20px;
          border: 1.5px solid var(--border-gold);
          box-shadow: 0 10px 30px rgba(245,184,0,0.08);
          overflow: hidden;
        }
        .quiz-tabs {
          display: flex;
          background: var(--light);
          border-bottom: 1.5px solid var(--border-gold);
        }
        .tab-btn {
          flex: 1;
          padding: 14px;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .tab-btn.active {
          background: var(--white);
          color: var(--orange);
          box-shadow: 0 -2px 0 var(--orange) inset;
        }
        .tab-content {
          padding: 24px;
        }
        .quiz-panel-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .quiz-panel-header h3 {
          font-family: var(--serif);
          font-style: italic;
          font-size: 19px;
          background: var(--grad-text);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .quiz-panel-header svg {
          color: var(--orange);
        }
        .quiz-field {
          margin-bottom: 20px;
        }
        .quiz-field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-md);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .file-selection-list {
          max-height: 120px;
          overflow-y: auto;
          border: 1.5px solid var(--border-gold);
          border-radius: 10px;
          background: var(--light);
          padding: 4px;
        }
        .file-select-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .file-select-item:hover { background: rgba(245,184,0,0.08); }
        .file-select-item.selected { background: var(--grad-soft); }
        .checkbox {
          width: 18px;
          height: 18px;
          border: 1.5px solid var(--border-gold);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--white);
          color: var(--orange);
        }
        .file-select-item.selected .checkbox {
          border-color: var(--orange);
          background: var(--orange);
          color: var(--white);
        }
        .file-name-small {
          font-size: 12px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .difficulty-toggle {
          display: flex;
          gap: 8px;
          background: var(--light2);
          padding: 4px;
          border-radius: 10px;
        }
        .diff-btn {
          flex: 1;
          padding: 8px;
          border: none;
          background: transparent;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-md);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .diff-btn.active {
          background: var(--white);
          color: var(--orange);
          box-shadow: 0 2px 8px rgba(240,101,0,0.15);
        }
        .quiz-field select {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          border: 1.5px solid var(--border-gold);
          background: var(--light);
          font-size: 13px;
          color: var(--text);
          outline: none;
        }
        .quiz-field select:focus { border-color: var(--orange); }
        .type-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .type-chip {
          padding: 6px 14px;
          border-radius: 20px;
          border: 1.5px solid var(--border-gold);
          background: var(--white);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-md);
          cursor: pointer;
          transition: all 0.2s;
        }
        .type-chip.active {
          background: var(--grad-soft);
          border-color: var(--orange);
          color: var(--orange);
        }
        .btn-generate-quiz {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          background: var(--grad);
          color: var(--white);
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 10px;
          box-shadow: 0 4px 16px rgba(240,101,0,0.3);
        }
        .btn-generate-quiz:hover:not(:disabled) { 
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(240,101,0,0.4);
        }
        .btn-generate-quiz:active:not(:disabled) { transform: translateY(0); }
        .btn-generate-quiz:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
        
        .spinner-tiny {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: var(--white);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .history-item {
          padding: 16px;
          background: var(--white);
          border-radius: 14px;
          border: 1.5px solid var(--border-gold);
          transition: transform 0.2s;
        }
        .history-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(245,184,0,0.08); }
        .history-item-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .diff-tag {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 6px;
          letter-spacing: 0.05em;
        }
        .diff-tag.easy { background: rgba(16,185,129,0.1); color: #059669; }
        .diff-tag.medium { background: rgba(245,184,0,0.1); color: var(--orange); }
        .diff-tag.hard { background: rgba(239,68,68,0.1); color: #dc2626; }
        .history-date { font-size: 10px; color: var(--text-dim); font-weight: 600; }
        .history-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 12px; }
        .history-score-bar { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; color: var(--text-md); }
        .score-text strong { color: var(--orange); font-size: 14px; }
        .progress-bar-tiny { height: 5px; background: var(--light2); border-radius: 3px; overflow: hidden; }
        .progress-fill-tiny { height: 100%; background: var(--grad); border-radius: 3px; }
        .empty-history { text-align: center; padding: 40px 0; color: var(--text-dim); font-size: 13px; }
      `}</style>
    </div>
  );
}
