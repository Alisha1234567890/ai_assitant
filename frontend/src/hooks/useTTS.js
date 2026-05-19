import { useState, useCallback } from "react";

let currentUtterance = null;

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [ttsLang, setTtsLang] = useState("en-US");
  const [ttsRate, setTtsRate] = useState(1);

  const speak = useCallback((text) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ttsLang;
    u.rate = ttsRate;
    u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    currentUtterance = u;
    window.speechSynthesis.speak(u);
  }, [ttsLang, ttsRate]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, ttsLang, setTtsLang, ttsRate, setTtsRate };
}
