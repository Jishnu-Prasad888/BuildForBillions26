// Ranks passages for a question: embedding similarity fused with keyword matching, the same idea as the backend's
// vector + full-text rank fusion. Pure TypeScript with no native imports, so it can be checked under plain Node.
//
// Keywords matter because a small embedder is weak on exact terms such as "PMFBY", "72 hours" or "RTC".

import type { Chunk } from './chunker';

export type Hit = { chunk: Chunk; score: number };

// Reciprocal-rank-fusion constant (the usual value).
const RRF_K = 60;
// A passage is only returned if it is at least this close in meaning, or shares a keyword with the question.
// This lets an off-topic question come back empty, so the model says it cannot verify instead of guessing.
export const MIN_COSINE = 0.2;

const STOPWORDS = new Set(
  ('a an and are as at be but by can do does for from how i if in is it me my of on or so that the their there ' +
    'this to was what when where which who why will with you your should would could about after before get ' +
    'have has need want').split(' ')
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

// Sum of inverse-document-frequency weights of the question words found in each passage (BM25-lite).
function keywordScores(question: string, chunks: readonly Chunk[]): number[] {
  const docs = chunks.map((c) => new Set(tokenize(`${c.title} ${c.text}`)));
  const idf = (term: string) => {
    const df = docs.filter((d) => d.has(term)).length;
    return Math.log(1 + chunks.length / (1 + df));
  };
  const terms = [...new Set(tokenize(question))];
  return docs.map((d) => terms.reduce((sum, t) => (d.has(t) ? sum + idf(t) : sum), 0));
}

function ranks(scores: readonly number[]): number[] {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b]! - scores[a]!);
  const rank = new Array<number>(scores.length);
  order.forEach((idx, r) => (rank[idx] = r));
  return rank;
}

export function retrieve(
  question: string,
  questionVector: Float32Array,
  chunks: readonly Chunk[],
  vectors: readonly Float32Array[],
  k: number
): Hit[] {
  if (chunks.length === 0) return [];

  const vec = vectors.map((v) => cosine(questionVector, v));
  const kw = keywordScores(question, chunks);
  const vecRank = ranks(vec);
  const kwRank = ranks(kw);

  return chunks
    .map((chunk, i) => ({
      chunk,
      score: 1 / (RRF_K + vecRank[i]!) + (kw[i]! > 0 ? 1 / (RRF_K + kwRank[i]!) : 0),
      relevant: vec[i]! >= MIN_COSINE || kw[i]! > 0,
    }))
    .filter((h) => h.relevant)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ chunk, score }) => ({ chunk, score }));
}
