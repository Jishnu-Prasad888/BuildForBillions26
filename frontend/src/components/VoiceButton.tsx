import { Mic, MicOff } from "lucide-react";

export default function VoiceButton({ listening, onStart, onStop, disabled, size = "md" }: { listening: boolean; onStart: () => void; onStop: () => void; disabled?: boolean; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const icon = size === "lg" ? 24 : size === "sm" ? 17 : 20;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={listening ? onStop : onStart}
      aria-label={listening ? "Stop listening" : "Speak"}
      aria-pressed={listening}
      className={`flex ${dim} flex-none items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
        listening ? "animate-pulseRing bg-saffron text-white" : "bg-forest-800 text-white hover:bg-forest-900"
      }`}
    >
      {listening ? <MicOff size={icon} /> : <Mic size={icon} />}
    </button>
  );
}
