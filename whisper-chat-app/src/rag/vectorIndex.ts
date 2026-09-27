import RNBlobUtil from 'react-native-blob-util';
import { chunkCorpus, embeddingText, type Chunk, type CorpusDocument } from './chunker';
import corpus from '../../assets/corpus.json';

// Embeds the bundled corpus once and keeps the vectors on the device, so later launches load them straight from
// disk without running the embedder again. The corpus itself (assets/corpus.json) ships inside the app.

export type EmbedFn = (text: string) => Promise<Float32Array>;
export type VectorIndex = { chunks: Chunk[]; vectors: Float32Array[] };

const INDEX_FILE = `${RNBlobUtil.fs.dirs.DocumentDir}/rag-index.json`;
const DECIMALS = 1e5;

// Any change to the passages or to the embedder gives a new key, so stale vectors are never reused.
function fingerprint(embedderId: string, chunks: readonly Chunk[]): string {
  const input = `${embedderId}|${chunks.map((c) => `${c.id}:${embeddingText(c)}`).join('|')}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}-${input.length}`;
}

async function readCache(key: string, expected: number): Promise<Float32Array[] | null> {
  try {
    if (!(await RNBlobUtil.fs.exists(INDEX_FILE))) return null;
    const stored = JSON.parse(await RNBlobUtil.fs.readFile(INDEX_FILE, 'utf8'));
    if (stored.key !== key || stored.vectors?.length !== expected) return null;
    return stored.vectors.map((v: number[]) => Float32Array.from(v));
  } catch (err) {
    console.warn('[rag] could not read the saved index, rebuilding it:', err);
    return null;
  }
}

async function writeCache(key: string, vectors: readonly Float32Array[]): Promise<void> {
  try {
    const rounded = vectors.map((v) => Array.from(v, (x) => Math.round(x * DECIMALS) / DECIMALS));
    await RNBlobUtil.fs.writeFile(INDEX_FILE, JSON.stringify({ key, vectors: rounded }), 'utf8');
  } catch (err) {
    // Not fatal: the index is rebuilt on the next launch.
    console.warn('[rag] could not save the index:', err);
  }
}

export async function loadOrBuildIndex(
  embed: EmbedFn,
  embedderId: string,
  onProgress?: (done: number, total: number) => void
): Promise<VectorIndex> {
  const chunks = chunkCorpus((corpus as { documents: CorpusDocument[] }).documents);
  if (chunks.length === 0) throw new Error('The bundled corpus is empty (assets/corpus.json).');

  const key = fingerprint(embedderId, chunks);
  const cached = await readCache(key, chunks.length);
  if (cached) {
    console.log(`[rag] loaded ${chunks.length} saved passage vectors`);
    return { chunks, vectors: cached };
  }

  // One at a time: the embedder rejects overlapping calls.
  const vectors: Float32Array[] = [];
  for (const chunk of chunks) {
    vectors.push(await embed(embeddingText(chunk)));
    onProgress?.(vectors.length, chunks.length);
  }
  await writeCache(key, vectors);
  console.log(`[rag] embedded ${chunks.length} passages and saved the index`);
  return { chunks, vectors };
}
