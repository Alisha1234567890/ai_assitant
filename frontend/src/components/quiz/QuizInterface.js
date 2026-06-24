import React, { useState } from "react";
import axios from "axios";
import { BASE } from "../../constants";
import { IC } from "../../icons/Icons";

export default function QuizInterface({ quiz, userId, onFinish }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [showSolutions, setShowSolutions] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [fillValue, setFillValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Safety check if quiz or questions are missing
  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="quiz-error-state">
        <p>⚠️ Error: Quiz data is invalid or empty.</p>
        <button className="btn-secondary-quiz" onClick={onFinish}>Return to Chat</button>
      </div>
    );
  }

  const currentQ = quiz.questions[currentIdx];
  const progress = ((currentIdx + (showResult ? 1 : 0)) / quiz.questions.length) * 100;

  const handleNext = () => {
    let userAnswer = currentQ.type === "fill_blank" ? fillValue : selectedOption;
    const isCorrect = userAnswer?.toString().toLowerCase().trim() === currentQ.correctAnswer.toString().toLowerCase().trim();
    
    const newAnswers = [...answers, {
      questionId: currentQ.id,
      userAnswer,
      isCorrect
    }];
    setAnswers(newAnswers);

    if (currentIdx < quiz.questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedOption(null);
      setFillValue("");
    } else {
      finishQuiz(newAnswers);
    }
  };

  const finishQuiz = async (finalAnswers) => {
    setShowResult(true);
    const score = finalAnswers.filter(a => a.isCorrect).length;
    setSaving(true);
    try {
      await axios.post(`${BASE}/quiz/save-score`, {
        quizId: quiz.quizId,
        chatId: quiz.chatId,
        userId,
        quizTitle: quiz.quizTitle,
        difficulty: quiz.difficulty,
        score,
        total: quiz.questions.length,
        answers: finalAnswers
      });
    } catch (e) {
      console.error("Failed to save score", e);
    } finally {
      setSaving(false);
    }
  };

  if (showResult) {
    const score = answers.filter(a => a.isCorrect).length;
    const percentage = Math.round((score / quiz.questions.length) * 100);
    
    return (
      <div className="quiz-result-page">
        {!showSolutions ? (
          <div className="result-summary-card">
            <div className="result-icon-anim">
              <IC.Award />
            </div>
            <h1 className="result-title">Quiz Completed!</h1>
            
            <div className="score-display">
              <div className="score-big">{score} <span className="score-sep">/</span> {quiz.questions.length}</div>
              <div className="score-label">Correct Answers</div>
            </div>

            <div className="feedback-section">
              <p className="feedback-msg">
                {score === quiz.questions.length ? "Perfect! You've mastered this topic!" : 
                 score >= quiz.questions.length * 0.7 ? "Great job! You have a solid understanding." : 
                 score >= quiz.questions.length * 0.5 ? "Good job! Keep learning to improve." : 
                 "Keep studying and try again to improve your score!"}
              </p>
              <div className="progress-mini">
                <div className="progress-mini-fill" style={{ width: `${percentage}%` }} />
              </div>
            </div>

            <div className="result-actions">
              <button className="btn-primary-quiz" onClick={() => setShowSolutions(true)}>
                <IC.Eye /> See Solutions
              </button>
              <button className="btn-secondary-quiz" onClick={onFinish}>
                Return to Chat
              </button>
            </div>
          </div>
        ) : (
          <div className="solutions-view">
            <div className="solutions-header">
              <button className="btn-back" onClick={() => setShowSolutions(false)}>
                <IC.Refresh /> Back to Summary
              </button>
              <h2>Detailed Solutions</h2>
            </div>

            <div className="solutions-list">
              {quiz.questions.map((q, i) => (
                <div key={i} className={`solution-card ${answers[i]?.isCorrect ? "correct" : "wrong"}`}>
                  <div className="sol-q-header">
                    <span className={`status-pill ${answers[i]?.isCorrect ? "correct" : "wrong"}`}>
                      {answers[i]?.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                    <span className="q-number">Question {i + 1}</span>
                  </div>
                  <p className="sol-q-text">{q.question}</p>
                  
                  <div className="sol-ans-compare">
                    <div className="ans-box">
                      <label>Your Answer</label>
                      <div className={`ans-val ${answers[i]?.isCorrect ? "val-correct" : "val-wrong"}`}>
                        {answers[i]?.userAnswer || "(No answer)"}
                      </div>
                    </div>
                    {!answers[i]?.isCorrect && (
                      <div className="ans-box">
                        <label>Correct Answer</label>
                        <div className="ans-val val-actual">{q.correctAnswer}</div>
                      </div>
                    )}
                  </div>

                  <div className="sol-explanation">
                    <div className="exp-label"><IC.Brain /> AI Explanation</div>
                    <p>{q.explanation}</p>
                    {q.sourceReference && (
                      <div className="sol-source">
                        <strong>Source:</strong> "{q.sourceReference}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <button className="btn-finish-bottom" onClick={onFinish}>Finish Review</button>
          </div>
        )}

        <style>{`
          .quiz-result-page {
            height: 100%;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            background: var(--off-white);
            padding: 40px 20px;
            overflow-y: auto;
          }
          
          .result-summary-card {
            background: var(--white);
            width: 100%;
            max-width: 500px;
            padding: 48px 32px;
            border-radius: 24px;
            box-shadow: 0 20px 50px rgba(245,184,0,0.1);
            border: 1.5px solid var(--border-gold);
            text-align: center;
            animation: slideUp 0.4s ease-out;
          }

          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .result-icon-anim {
            width: 80px;
            height: 80px;
            background: var(--grad-soft);
            color: var(--orange);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
          }
          .result-icon-anim svg { width: 40px; height: 40px; }

          .result-title {
            font-family: var(--serif);
            font-size: 28px;
            font-style: italic;
            background: var(--grad-text);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 32px;
          }

          .score-display {
            margin-bottom: 32px;
          }
          .score-big {
            font-size: 64px;
            font-weight: 900;
            color: var(--orange);
            line-height: 1;
          }
          .score-sep { color: var(--light2); margin: 0 8px; }
          .score-label {
            font-size: 14px;
            font-weight: 700;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 8px;
          }

          .feedback-section {
            background: var(--light);
            padding: 24px;
            border-radius: 16px;
            margin-bottom: 32px;
            border: 1px solid var(--border-gold);
          }
          .feedback-msg {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-md);
            margin-bottom: 16px;
            line-height: 1.5;
          }
          .progress-mini {
            height: 8px;
            background: var(--light2);
            border-radius: 4px;
            overflow: hidden;
          }
          .progress-mini-fill {
            height: 100%;
            background: var(--grad);
            border-radius: 4px;
          }

          .result-actions {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .btn-primary-quiz {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 14px;
            background: var(--grad);
            color: var(--white);
            border: none;
            border-radius: 14px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 16px rgba(240,101,0,0.3);
          }
          .btn-primary-quiz:hover { 
            opacity: 0.9; 
            transform: translateY(-1px);
            box-shadow: 0 6px 22px rgba(240,101,0,0.4);
          }
          
          .btn-secondary-quiz {
            padding: 14px;
            background: var(--white);
            color: var(--text-md);
            border: 1.5px solid var(--border-gold);
            border-radius: 14px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-secondary-quiz:hover { background: var(--light); border-color: var(--orange); color: var(--orange); }

          /* Solutions View */
          .solutions-view {
            width: 100%;
            max-width: 800px;
            animation: fadeIn 0.3s ease-in;
          }
          .solutions-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
          }
          .btn-back {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--white);
            border: 1.5px solid var(--border-gold);
            padding: 8px 16px;
            border-radius: 10px;
            font-weight: 600;
            color: var(--text-md);
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-back:hover { border-color: var(--orange); color: var(--orange); }
          .solutions-header h2 { 
            font-family: var(--serif);
            font-size: 24px; 
            font-style: italic;
            background: var(--grad-text);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .solutions-list { display: flex; flex-direction: column; gap: 24px; }
          .solution-card {
            background: var(--white);
            padding: 28px;
            border-radius: 20px;
            border: 1.5px solid var(--border-gold);
            border-left: 6px solid var(--border-gold);
            box-shadow: 0 4px 12px rgba(245,184,0,0.05);
          }
          .solution-card.correct { border-left-color: #10b981; }
          .solution-card.wrong { border-left-color: #ef4444; }

          .sol-q-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
          .status-pill {
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .status-pill.correct { background: rgba(16,185,129,0.1); color: #059669; }
          .status-pill.wrong { background: rgba(239,68,68,0.1); color: #dc2626; }
          .q-number { font-size: 12px; font-weight: 700; color: var(--text-dim); }
          
          .sol-q-text { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 24px; line-height: 1.5; }

          .sol-ans-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          @media (max-width: 600px) { .sol-ans-compare { grid-template-columns: 1fr; } }
          
          .ans-box label { display: block; font-size: 11px; font-weight: 700; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.03em; }
          .ans-val { padding: 14px; border-radius: 12px; font-weight: 700; font-size: 14px; border: 1.5px solid transparent; }
          .val-correct { background: rgba(16,185,129,0.05); color: #065f46; border-color: rgba(16,185,129,0.2); }
          .val-wrong { background: rgba(239,68,68,0.05); color: #991b1b; border-color: rgba(239,68,68,0.2); }
          .val-actual { background: var(--grad-soft); color: var(--orange); border-color: var(--border-gold); }

          .sol-explanation { background: var(--light); padding: 20px; border-radius: 14px; border: 1px solid var(--border-gold); }
          .exp-label { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--text); margin-bottom: 10px; font-size: 13px; }
          .exp-label svg { color: var(--orange); }
          .sol-explanation p { font-size: 14px; line-height: 1.7; color: var(--text-md); }
          .sol-source { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border-gold); font-size: 12px; color: var(--text-dim); font-style: italic; }

          .btn-finish-bottom {
            display: block;
            margin: 40px auto 0;
            padding: 14px 48px;
            background: var(--grad);
            color: var(--white);
            border: none;
            border-radius: 14px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 16px rgba(240,101,0,0.3);
          }
          .btn-finish-bottom:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 22px rgba(240,101,0,0.4); }

          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <div className="quiz-info">
          <h3>{quiz.quizTitle}</h3>
          <span>Question {currentIdx + 1} <small>of</small> {quiz.questions.length}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="question-box">
        <p className="question-text">{currentQ.question}</p>
        
        {currentQ.type === "mcq" || currentQ.type === "true_false" ? (
          <div className="options-grid">
            {(currentQ.options || []).map((opt, i) => (
              <button 
                key={i} 
                className={`option-btn ${selectedOption === opt ? "selected" : ""}`}
                onClick={() => setSelectedOption(opt)}
              >
                {opt}
              </button>
            ))}
            {(!currentQ.options || currentQ.options.length === 0) && (
              <p className="error-text">⚠️ No options provided for this question.</p>
            )}
          </div>
        ) : (
          <div className="fill-box">
            <input 
              type="text" 
              placeholder="Type your answer here..." 
              value={fillValue}
              onChange={e => setFillValue(e.target.value)}
              autoFocus
            />
          </div>
        )}
      </div>

      <div className="quiz-footer">
        <button 
          className="btn-next" 
          onClick={handleNext}
          disabled={currentQ.type === "fill_blank" ? !fillValue.trim() : !selectedOption}
        >
          {currentIdx === quiz.questions.length - 1 ? "Finish Quiz" : "Next Question"}
        </button>
      </div>

      <style>{`
        .quiz-container {
          background: var(--white);
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
          border: 1.5px solid var(--border-gold);
          box-shadow: 0 10px 30px rgba(245,184,0,0.06);
        }
        .quiz-header {
          padding: 24px 32px;
          border-bottom: 1.5px solid var(--border-gold);
          background: linear-gradient(180deg, rgba(245,184,0,0.03) 0%, transparent 100%);
        }
        .quiz-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .quiz-info h3 { 
          font-family: var(--serif);
          font-style: italic;
          font-size: 20px; 
          background: var(--grad-text);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .quiz-info span { font-size: 13px; color: var(--text-dim); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .quiz-info small { color: var(--text-dim); font-weight: 400; text-transform: lowercase; }
        
        .progress-bar { height: 6px; background: var(--light2); border-radius: 3px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--grad); transition: width 0.3s ease; }

        .question-box { padding: 40px; flex: 1; overflow-y: auto; background: radial-gradient(circle at top right, rgba(245,184,0,0.04), transparent); }
        .question-text { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 36px; line-height: 1.5; }
        
        .options-grid { display: grid; gap: 14px; }
        .option-btn {
          padding: 18px 24px;
          border: 1.5px solid var(--border-gold);
          background: var(--white);
          border-radius: 14px;
          text-align: left;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-md);
          cursor: pointer;
          transition: all 0.2s;
        }
        .option-btn:hover { border-color: var(--orange); background: var(--grad-soft); transform: translateX(4px); }
        .option-btn.selected { border-color: var(--orange); background: var(--grad); color: var(--white); box-shadow: 0 4px 12px rgba(240,101,0,0.25); }

        .fill-box input {
          width: 100%;
          padding: 18px 24px;
          border: 1.5px solid var(--border-gold);
          border-radius: 14px;
          font-size: 18px;
          font-weight: 600;
          color: var(--text);
          background: var(--light);
          outline: none;
          transition: all 0.2s;
        }
        .fill-box input:focus { border-color: var(--orange); background: var(--white); box-shadow: 0 0 0 4px rgba(240,101,0,0.08); }
        .fill-box input::placeholder { color: var(--text-dim); font-weight: 400; }

        .quiz-footer { padding: 24px 32px; border-top: 1px solid var(--border-gold); display: flex; justify-content: flex-end; background: var(--white); }
        .btn-next {
          padding: 14px 40px;
          background: var(--grad);
          color: var(--white);
          border: none;
          border-radius: 14px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(240,101,0,0.3);
        }
        .btn-next:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 22px rgba(240,101,0,0.4); }
        .btn-next:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }
        
        .error-text { color: #ef4444; font-size: 14px; font-weight: 500; text-align: center; margin-top: 10px; }
        .quiz-error-state { padding: 40px; text-align: center; }
      `}</style>
    </div>
  );
}
