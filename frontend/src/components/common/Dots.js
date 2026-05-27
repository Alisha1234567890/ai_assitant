import React from "react";

export default function Dots() {
  return (
    <span className="dots-wrap">
      {[0, 1, 2].map((i) => <span key={i} className="dot" style={{ animationDelay: `${i * 0.18}s` }} />)}
    </span>
  );
}
