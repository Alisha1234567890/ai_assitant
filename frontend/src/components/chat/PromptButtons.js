import React from "react";
import { IC } from "../../icons/Icons";

export default function PromptButtons({ onOpenSystem, systemActive }) {
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
