import React from "react";
import { IC } from "../../icons/Icons";

export default function GraphButton({ active, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`prompt-btn graph-btn ${
        active ? "prompt-btn-active graph-btn-active" : ""
      }`}
      onClick={onClick}
      disabled={disabled}
      title={
        disabled
          ? "Ask a question first to explore the knowledge map"
          : "Knowledge map — related concepts"
      }
    >
      <IC.Graph />
      <span>Graph</span>
    </button>
  );
}