import React, { useState } from "react";
// import GenerateVideoButton from "../GenerateVideoButton";
import { IC } from "../../icons/Icons";
import Dots from "../common/Dots";

export default function Bubble({ msg, onSpeak, speaking, userInitial = "U" }) {
  const [showConfidenceModal, setShowConfidenceModal] = useState(false);
  const isUser = msg.type === "user";
  const hasConfidence = msg.confidence !== undefined && msg.confidence !== null;

  // Determine confidence color and description
  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return "#22c55e"; // Green
    if (confidence >= 60) return "#eab308"; // Yellow
    if (confidence >= 40) return "#f97316"; // Orange
    return "#ef4444"; // Red
  };

  const getConfidenceDescription = (confidence) => {
    if (confidence >= 80) return "High confidence — answer is likely from your document";
    if (confidence >= 60) return "Moderate confidence — answer is probably from your document";
    if (confidence >= 40) return "Low confidence — answer may not be from your document";
    return "Very low confidence — answer may not be from your document";
  };

  return (
    <>
      <div className={`bubble-row ${isUser ? "bubble-right" : "bubble-left"}`}>

        {!isUser && (
          <div className="avatar avatar-bot">
            <IC.Bot />
          </div>
        )}

        <div className={`bubble ${isUser ? "bubble-user" : "bubble-ai"}`}>
          {msg.typing ? <Dots /> : (msg.text || <Dots />)}
        </div>

        {!isUser && !msg.typing && msg.text && (

          <div className="bubble-actions">

            <button
              className={`speak-btn ${speaking ? "speak-btn-active" : ""}`}
              onClick={() => onSpeak(msg.text)}
              title="Read aloud"
            >
              <IC.Volume />
            </button>

            {hasConfidence && (
              <button
                className="confidence-btn"
                onClick={() => setShowConfidenceModal(true)}
                title="View confidence score"
                style={{ 
                  borderColor: getConfidenceColor(msg.confidence),
                  color: getConfidenceColor(msg.confidence)
                }}
              >
                {Math.round(msg.confidence)}%
              </button>
            )}

            {/* <GenerateVideoButton
              answer={msg.text}
            /> */}

          </div>

        )}

        {isUser && (
          <div className="avatar avatar-user">
            {userInitial}
          </div>
        )}

      </div>

      {/* Confidence Modal */}
      {showConfidenceModal && hasConfidence && (
        <div className="confidence-modal-overlay" onClick={() => setShowConfidenceModal(false)}>
          <div className="confidence-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confidence-modal-header">
              <div>
                <div className="confidence-modal-title">Confidence Score</div>
              </div>
              <button className="confidence-modal-close" onClick={() => setShowConfidenceModal(false)}>
                ✕
              </button>
            </div>
            <div className="confidence-modal-content">
              <div 
                className="confidence-score-display"
                style={{ background: `linear-gradient(135deg, ${getConfidenceColor(msg.confidence)}, var(--orange))`, WebkitBackgroundClip: 'text' }}
              >
                {Math.round(msg.confidence)}%
              </div>
              <div className="confidence-bar">
                <div 
                  className="confidence-bar-fill" 
                  style={{ 
                    width: `${msg.confidence}%`,
                    background: `linear-gradient(90deg, ${getConfidenceColor(msg.confidence)}, var(--orange))`
                  }}
                />
              </div>
              <div className="confidence-description">
                {getConfidenceDescription(msg.confidence)}
              </div>
              <div className="confidence-description" style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                Based on retrieval similarity between your question and document chunks
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}