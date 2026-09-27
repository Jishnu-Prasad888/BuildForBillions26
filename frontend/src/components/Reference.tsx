import { Quote, X } from "lucide-react";

export interface ReferenceState {
  id: string;    // message_id from backend
  text: string;  // content of the referenced message
}

interface QuoteButtonProps {
  messageId: string;
  text: string;
  onSet: (ref: ReferenceState) => void;
}

export function QuoteButton({ messageId, text, onSet }: QuoteButtonProps) {
  return (
    <button
      className="mt-1.5 flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-forest-700"
      title="Reference this answer"
      onClick={() => onSet({ id: messageId, text })}
    >
      <Quote size={13} /> Reference
    </button>
  );
}

interface ReferenceChipProps {
  reference: ReferenceState;
  onClear: () => void;
}

export function ReferenceChip({ reference, onClear }: ReferenceChipProps) {
  const preview = reference.text.length > 60 ? reference.text.slice(0, 60) + "…" : reference.text;
  return (
    <div className="mb-2 flex items-start gap-2 rounded-xl bg-forest-50 px-3 py-1.5 text-xs text-forest-800 ring-1 ring-forest-100">
      <Quote size={12} className="mt-0.5 flex-none text-forest-600" />
      <span className="min-w-0 flex-1 break-words">
        <span className="font-medium">Referencing:</span> {preview}
      </span>
      <button onClick={onClear} className="flex-none text-forest-600 hover:text-forest-800" title="Clear reference">
        <X size={13} />
      </button>
    </div>
  );
}
