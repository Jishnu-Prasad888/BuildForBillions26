// Splits the bundled corpus (assets/corpus.json) into passages for the embedder.
// Pure TypeScript with no native imports, so it can be checked under plain Node.

export type CorpusDocument = { id: string; title: string; source: string; text: string };
export type Chunk = { id: string; docId: string; title: string; source: string; text: string };

// all-MiniLM-L6-v2 truncates at 256 word pieces (~1000 English characters), so passages stay well under that
// even after the overlap carried in from the previous one.
export const CHUNK_TARGET_CHARS = 700;
export const CHUNK_OVERLAP_CHARS = 100;

// Lines are the natural unit here (list items, "Label: value" rows). A line longer than `size` is cut at a
// sentence end, or failing that at a space, so nothing is ever dropped.
function pieces(text: string, size: number): string[] {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    let rest = raw.trim();
    while (rest.length > size) {
      const window = rest.slice(0, size);
      const cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf(' '));
      const at = cut > size * 0.4 ? cut + 1 : size;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

// The last `overlap` characters, starting at a word boundary, so a fact split across two passages appears in both.
function overlapTail(text: string, overlap: number): string {
  if (text.length <= overlap) return text;
  const tail = text.slice(-overlap);
  const space = tail.indexOf(' ');
  return space >= 0 ? tail.slice(space + 1) : tail;
}

export function chunkDocument(
  doc: CorpusDocument,
  target = CHUNK_TARGET_CHARS,
  overlap = CHUNK_OVERLAP_CHARS
): Chunk[] {
  const texts: string[] = [];
  let current = '';
  for (const piece of pieces(doc.text, target)) {
    if (current && current.length + 1 + piece.length > target) {
      texts.push(current);
      current = overlapTail(current, overlap);
    }
    current = current ? `${current}\n${piece}` : piece;
  }
  if (current) texts.push(current);

  return texts.map((text, i) => ({
    id: `${doc.id}#${i + 1}`,
    docId: doc.id,
    title: doc.title,
    source: doc.source,
    text,
  }));
}

export function chunkCorpus(docs: readonly CorpusDocument[]): Chunk[] {
  return docs.flatMap((doc) => chunkDocument(doc));
}

// What the embedder sees for a passage: the title gives a short fragment the context it lost when it was cut out.
export function embeddingText(chunk: Chunk): string {
  return `${chunk.title}\n${chunk.text}`;
}
