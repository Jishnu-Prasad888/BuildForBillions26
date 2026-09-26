import { Mic, MicOff } from "lucide-react";

export default function VoiceButton({ listening, onStart, onStop, disabled, size = "md" }: { listening: boolean; onStart: () => void; onStop: () => void; disabled?: boolean; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={listening ? onStop : onStart}
      aria-label={listening ? "Stop listening" : "Speak"}
      aria-pressed={listening}
      className={`flex ${dim} flex-none items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
        listening ? "animate-pulseRing bg-saffron text-white" : "bg-ink-800 text-white hover:bg-ink-700"
      }`}
    >
      {listening ? <MicOff size={size === "lg" ? 24 : 20} /> : <Mic size={size === "lg" ? 24 : 20} />}
    </button>
  );
}
