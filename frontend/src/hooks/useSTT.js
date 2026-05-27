import { useState, useEffect, useRef, useCallback } from "react";

export function useSTT({ onResult, onInterim, sttLang }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recogRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported. Use Chrome or Edge."); return; }

    window.speechSynthesis.cancel();

    const r = new SR();
    r.lang = sttLang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) onInterim(interim);
      if (final) onResult(final);
    };

    r.onerror = (e) => {
      console.error("STT error:", e.error);
      setListening(false);
      if (e.error === "not-allowed") alert("Microphone permission denied. Please allow mic access.");
    };

    r.onend = () => setListening(false);

    recogRef.current = r;
    r.start();
    setListening(true);
  }, [sttLang, onResult, onInterim]);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, startListening, stopListening };
}
