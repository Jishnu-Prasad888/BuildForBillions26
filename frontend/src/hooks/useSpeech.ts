import { useCallback, useEffect, useRef, useState } from "react";
import { speechLang } from "@/i18n";
import type { Lang } from "@/types";

/* Browser speech: Web Speech API for recognition (Chrome/Edge) + speechSynthesis for TTS. */

type Recognition = any;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function useSpeechInput(lang: Lang, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const cbRef = useRef(onFinal);
  cbRef.current = onFinal;

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input is not supported in this browser. Please use Chrome or Edge, or type instead.");
      return;
    }
    window.speechSynthesis?.cancel();
    const rec: Recognition = new SR();
    rec.lang = speechLang(lang);
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let fin = "";
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else tmp += r[0].transcript;
      }
      setInterim(tmp);
      if (fin.trim()) {
        setInterim("");
        cbRef.current(fin.trim());
      }
    };
    rec.onerror = (e: any) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(e.error === "not-allowed" ? "Microphone permission was denied." : `Voice error: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }, [lang]);

  useEffect(() => () => recRef.current?.abort?.(), []);
  return { listening, interim, error, start, stop, supported: speechSupported() };
}

export function cleanForSpeech(md: string): string {
  return md
    .replace(/\[(chunk|fact)_[a-z0-9_]+\]/g, "")
    .replace(/[*_>#`]/g, "")
    .replace(/•+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function speak(text: string, lang: Lang, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
  const code = speechLang(lang);
  u.lang = code;
  const voice = synth.getVoices().find((v) => v.lang === code) || synth.getVoices().find((v) => v.lang.startsWith(code.slice(0, 2)));
  if (voice) u.voice = voice;
  u.rate = lang === "en" ? 1 : 0.95;
  if (onEnd) {
    u.onend = () => onEnd();
    u.onerror = () => onEnd();
  }
  synth.speak(u);
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}
