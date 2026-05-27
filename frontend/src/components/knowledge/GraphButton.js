import React from "react";
import { IC } from "../../icons/Icons";

export default function GraphButton({ active, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`prompt-btn graph-btn ${active ? "prompt-btn-active graph-btn-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Upload PDFs or ask a question to open the knowledge graph" : "Semantic knowledge graph"}
    >
      <IC.Graph />
      <span>Graph</span>
    </button>
  );
}
