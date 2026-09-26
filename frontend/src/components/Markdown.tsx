import { Fragment, type ReactNode } from "react";

/* Tiny markdown renderer for assistant answers: paragraphs, lists, blockquotes,
   **bold**, _italic_ and citation markers like [chunk_ab12] / [fact_x] which become
   numbered, clickable evidence chips. */

interface Props {
  text: string;
  citationOrder?: string[];
  onCite?: (id: string) => void;
}

const INLINE = /(\*\*[^*]+\*\*|_[^_]+_|\[(?:chunk|fact)_[a-z0-9_]+\])/g;

function inline(text: string, order: string[], onCite?: (id: string) => void): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^_[^_]+_$/.test(part)) return <em key={i} className="text-ink-600">{part.slice(1, -1)}</em>;
    const m = part.match(/^\[((?:chunk|fact)_[a-z0-9_]+)\]$/);
    if (m) {
      const idx = order.indexOf(m[1]);
      if (idx < 0) return null;
      return (
        <button key={i} type="button" className="cite" title={`Evidence ${m[1]}`} onClick={() => onCite?.(m[1])}>
          {idx + 1}
        </button>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function Markdown({ text, citationOrder = [], onCite }: Props) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flushList = () => {
    if (list) {
      const L = list.type;
      blocks.push(
        <L key={blocks.length}>
          {list.items.map((it, i) => (
            <li key={i}>{inline(it, citationOrder, onCite)}</li>
          ))}
        </L>,
      );
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push(<blockquote key={blocks.length}>{quote.map((q, i) => <div key={i}>{inline(q, citationOrder, onCite)}</div>)}</blockquote>);
      quote = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-•]\s+(.*)/);
    const ol = line.match(/^\s*\d+\.\s+(.*)/);
    const bq = line.match(/^>\s?(.*)/);
    if (bq) {
      flushList();
      quote.push(bq[1].replace(/^[-•]\s+/, "• "));
      continue;
    }
    flushQuote();
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ul || ol)![1]);
      continue;
    }
    flushList();
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line, citationOrder, onCite)}</p>);
  }
  flushList();
  flushQuote();
  return <div className="prose-chat">{blocks}</div>;
}

export function citationOrderFrom(text: string, evidenceIds: string[]): string[] {
  const seen: string[] = [];
  for (const m of text.matchAll(/\[((?:chunk|fact)_[a-z0-9_]+)\]/g)) if (!seen.includes(m[1]) && evidenceIds.includes(m[1])) seen.push(m[1]);
  for (const id of evidenceIds) if (!seen.includes(id)) seen.push(id);
  return seen;
}
