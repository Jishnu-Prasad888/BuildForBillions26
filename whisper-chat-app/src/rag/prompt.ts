// The grounded prompt for Gemma. A shorter version of the backend's SYSTEM_PROMPT (backend/app/kag/prompts.py):
// a 2B model follows a few plain rules better than a long list. Plain text out, no JSON. Pure TypeScript.

import type { Hit } from './retrieve';

export const SYSTEM_PROMPT = `You are an offline assistant that helps Indian citizens understand government schemes and how to apply for them.

Answer ONLY from the numbered SOURCES in the user's message. If the sources do not contain the answer, say you cannot verify it from the available sources and suggest checking the official portal. Never invent amounts, dates, deadlines, documents, phone numbers or web addresses.

Answer the question in the first sentence, then add only the details that help. Use short, simple sentences. Use bullet points for lists and numbered steps for "how to" questions. Keep it under 150 words. Put the source number, like [1], after each fact it supports.

Sources marked DEMO are prototype summaries: remind the user to confirm on the official portal.`;

// Rough characters-per-token for English text. Deliberately low, so the estimate errs towards "too many tokens".
const CHARS_PER_TOKEN = 3;

export type BuiltPrompt = { user: string; used: Hit[]; dropped: number };

function render(question: string, hits: readonly Hit[]): string {
  const sources = hits.length
    ? hits.map((h, i) => `[${i + 1}] ${h.chunk.title}\n${h.chunk.text}`).join('\n\n')
    : '(no relevant sources were found)';
  return `SOURCES:\n${sources}\n\nQUESTION: ${question}`;
}

// Fits the sources into the model's context window. `maxSeqLen` is the window size, `reserveTokens` is kept free for
// the answer. Sources are ranked best first, so it is the weakest ones that get dropped; `dropped` reports how many.
export function buildUserPrompt(
  question: string,
  hits: readonly Hit[],
  maxSeqLen: number,
  reserveTokens: number
): BuiltPrompt {
  const budgetChars = (maxSeqLen - reserveTokens) * CHARS_PER_TOKEN - SYSTEM_PROMPT.length;
  const used = [...hits];
  while (used.length > 0 && render(question, used).length > budgetChars) used.pop();
  if (render(question, used).length > budgetChars) {
    throw new Error(`The question is too long for the model's ${maxSeqLen}-token context window.`);
  }
  return { user: render(question, used), used, dropped: hits.length - used.length };
}
