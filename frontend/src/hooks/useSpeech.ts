import { useCallback, useEffect, useRef, useState } from "react";
import { speechLang } from "@/i18n";
import type { Lang } from "@/types";

/* Browser speech: Web Speech API for recognition (Chrome/Edge) + speechSynthesis for TTS. */

type Recognition = any;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

const MAX_NETWORK_RETRIES = 2;

function isBrave(): boolean {
  return !!(navigator as any).brave;
}

function voiceErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied. Allow microphone access in your browser's site settings.";
    case "audio-capture":
      return "No microphone was found. Check that a microphone is connected.";
    case "language-not-supported":
      return "Voice input isn't available for this language in your browser. Please type instead.";
    case "network":
      if (!navigator.onLine) return "You appear to be offline. Voice input needs an internet connection.";
      if (isBrave()) return "Brave blocks the speech service voice input depends on. Please use Chrome or Edge, or type instead.";
      return "Couldn't reach the browser's speech service. Check your connection (VPNs and firewalls can block it) and try again, or type instead.";
    default:
      return `Voice error: ${code}`;
  }
}

export function useSpeechInput(lang: Lang, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const retriesRef = useRef(0);
  const cbRef = useRef(onFinal);
  cbRef.current = onFinal;

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  const begin = useCallback((isRetry: boolean) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input is not supported in this browser. Please use Chrome or Edge, or type instead.");
      return;
    }
    if (!isRetry) retriesRef.current = 0;
    if (isBrave()) {
      setError(voiceErrorMessage("network"));
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
    let retrying = false;
    rec.onerror = (e: any) => {
      if (e.error === "network" && navigator.onLine && retriesRef.current < MAX_NETWORK_RETRIES) {
        retriesRef.current += 1;
        retrying = true;
        return;
      }
      if (e.error !== "no-speech" && e.error !== "aborted") setError(voiceErrorMessage(e.error));
      setListening(false);
    };
    rec.onend = () => {
      if (retrying && recRef.current === rec) {
        setTimeout(() => { if (recRef.current === rec) beginRef.current(true); }, 500);
        return;
      }
      setListening(false);
    };
    recRef.current = rec;
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setError("Couldn't start voice input. Please try again.");
      setListening(false);
    }
  }, [lang]);

  const beginRef = useRef(begin);
  beginRef.current = begin;
  const start = useCallback(() => begin(false), [begin]);

  useEffect(() => () => { recRef.current?.abort?.(); recRef.current = null; }, []);
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
