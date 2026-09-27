import { useCallback, useEffect, useRef, useState } from 'react';
import {
  models,
  useModel,
  useResourceDownload,
  useTextEmbedder,
} from 'react-native-executorch';
import { createAnswerSession } from '../rag/answerSession';
import { buildUserPrompt, SYSTEM_PROMPT } from '../rag/prompt';
import { retrieve } from '../rag/retrieve';
import { loadOrBuildIndex, type VectorIndex } from '../rag/vectorIndex';

// Gemma 4 E2B is the smallest Gemma 4 the library ships (~2.6 GB). DEFAULT picks the backend for this platform;
// pin models.llm.GEMMA4_E2B.XNNPACK_8DA4W if the GPU (Vulkan) build misbehaves on a device.
const LLM_MODEL = models.llm.GEMMA4_E2B.DEFAULT;
// English-only 384-dim sentence embedder (~90 MB), the retrieval half of the RAG.
const EMBEDDER_MODEL = models.textEmbeddings.ALL_MINILM_L6_V2.DEFAULT;
const EMBEDDER_ID = 'all-MiniLM-L6-v2';

const TOP_K = 4;
// Answers are short by design (see the prompt); this also bounds how long a slow phone generates for.
const MAX_NEW_TOKENS = 320;
// Low: this is an answer-from-sources task, not a creative one.
const TEMPERATURE = 0.2;

export type LoadStage = {
  label: string;
  ready: boolean;
  /** 0–100 */
  progress: number;
  error?: Error;
};

export type RagAnswer = {
  text: string;
  sources: { title: string; source: string }[];
};

const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

export function useGemmaRag() {
  const llmDownload = useResourceDownload(LLM_MODEL);
  const { model: session, error: llmError } = useModel(createAnswerSession, llmDownload.resource);
  const embedder = useTextEmbedder(EMBEDDER_MODEL);
  const { embed } = embedder;

  const [index, setIndex] = useState<VectorIndex | null>(null);
  const [indexProgress, setIndexProgress] = useState(0);
  const [indexError, setIndexError] = useState<Error | undefined>();

  // Embeds the corpus the first time; afterwards the saved vectors are loaded from the device.
  useEffect(() => {
    if (!embed) return;
    let cancelled = false;
    setIndex(null);
    setIndexError(undefined);
    loadOrBuildIndex(embed, EMBEDDER_ID, (done, total) => {
      if (!cancelled) setIndexProgress((done / total) * 100);
    })
      .then((built) => {
        if (!cancelled) setIndex(built);
      })
      .catch((e) => {
        console.warn('[rag] building the index failed:', e);
        if (!cancelled) setIndexError(asError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [embed]);

  const busyRef = useRef(false);

  const ask = useCallback(
    async (question: string, onToken?: (token: string) => void): Promise<RagAnswer> => {
      if (!session || !embed || !index) throw new Error('The offline assistant is still loading.');
      if (busyRef.current) throw new Error('Still answering the previous question.');
      busyRef.current = true;
      try {
        const hits = retrieve(question, await embed(question), index.chunks, index.vectors, TOP_K);
        const { user, used, dropped } = buildUserPrompt(question, hits, session.maxSeqLen, MAX_NEW_TOKENS);
        if (dropped > 0) {
          console.warn(`[rag] dropped ${dropped} source(s) that did not fit the ${session.maxSeqLen}-token window`);
        }
        const { text, stats } = await session.answer(
          SYSTEM_PROMPT,
          user,
          { maxNewTokens: MAX_NEW_TOKENS, temperature: TEMPERATURE },
          onToken
        );
        console.log(
          `[rag] ${used.length} sources, ${stats.numPromptTokens} prompt + ${stats.numGeneratedTokens} generated ` +
            `tokens (window ${session.maxSeqLen})`
        );
        return { text, sources: used.map((h) => ({ title: h.chunk.title, source: h.chunk.source })) };
      } finally {
        busyRef.current = false;
      }
    },
    [session, embed, index]
  );

  const stages: LoadStage[] = [
    {
      label: 'Gemma 4 (answers)',
      ready: !!session,
      progress: llmDownload.downloadProgress,
      error: llmDownload.downloadError ?? llmError,
    },
    { label: 'Embedder (search)', ready: !!embed, progress: embedder.downloadProgress, error: embedder.error },
    { label: 'Data index', ready: !!index, progress: indexProgress, error: indexError },
  ];

  return { isReady: !!session && !!index, stages, ask, stop: session?.stop };
}
