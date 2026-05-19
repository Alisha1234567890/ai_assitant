import React from "react";
import { IC } from "../../icons/Icons";
import { USER_ID } from "../../constants";
import Dots from "../common/Dots";

export default function Bubble({ msg, onSpeak, speaking }) {
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
