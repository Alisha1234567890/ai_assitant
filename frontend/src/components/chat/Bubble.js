import React from "react";
// import GenerateVideoButton from "../GenerateVideoButton";
import { IC } from "../../icons/Icons";
import Dots from "../common/Dots";

export default function Bubble({ msg, onSpeak, speaking, userInitial = "U" }) {

  const isUser = msg.type === "user";

  return (

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

  );
}