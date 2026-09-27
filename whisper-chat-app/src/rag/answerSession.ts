import RNBlobUtil from 'react-native-blob-util';
import { scheduleOnRN } from 'react-native-worklets';
import { createResourceScope, llm, wrapAsync, type LLMModel } from 'react-native-executorch';

// A stateless single-turn LLM session, for retrieval-augmented answers.
//
// The library's own chat session (useLLMChatSession / createLLMChatSession) keeps every turn in its history, and each
// RAG turn carries its retrieved passages. After a couple of questions that overflows Gemma's context window (or, with
// resetOnTurn, re-reads all the old passages before every answer). Here every question starts from an empty KV cache:
// system prompt + this question's sources + the question, nothing else. Same building blocks as the library's session.

export type AnswerOptions = {
  readonly maxNewTokens: number;
  readonly temperature: number;
};

export type Answer = { readonly text: string; readonly stats: llm.LLMGenerationStats };

export type AnswerSession = {
  /** The model's context window in tokens. */
  readonly maxSeqLen: number;
  answer(
    system: string,
    user: string,
    options: AnswerOptions,
    onToken?: (token: string) => void
  ): Promise<Answer>;
  stop(): void;
  dispose(): void;
};

// Runs on the worklet thread, off the JS thread, so streaming tokens never block the UI.
function generateWorklet(
  runner: llm.LLMRunner,
  prompt: llm.Prompt,
  genConfig: llm.LLMGenerationConfig,
  stopTokens: readonly string[],
  onToken?: (token: string) => void
): Answer {
  'worklet';
  let text = '';
  const stats = runner.generate(prompt, genConfig, (token: string) => {
    if (stopTokens.includes(token)) return;
    text += token;
    if (onToken) scheduleOnRN(onToken, token);
  });
  return { text, stats };
}

export async function createAnswerSession(config: LLMModel): Promise<AnswerSession> {
  const scope = createResourceScope();
  try {
    const tokenizerConfig = llm.parseTokenizerConfig(
      JSON.parse(await RNBlobUtil.fs.readFile(config.tokenizerConfigPath, 'utf8'))
    );
    const preprocessor = scope.track(llm.createChatPreprocessor({ chatTemplate: tokenizerConfig.chatTemplate }));
    const runner = scope.track(await wrapAsync(llm.createLLMRunner)(config.modelPath, config.tokenizerPath));
    const generate = wrapAsync(generateWorklet);

    return {
      maxSeqLen: runner.getKVCacheState().maxSeqLen,
      answer: async (system, user, options, onToken) => {
        runner.reset();
        try {
          const prompt = preprocessor.process(
            [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            2,
            { addGenPrompt: true }
          );
          const generation = { maxNewTokens: options.maxNewTokens, temperature: options.temperature };
          const result = await generate(runner, prompt, generation, tokenizerConfig.stopTokens, onToken);
          return { text: result.text.trim(), stats: result.stats };
        } finally {
          preprocessor.clear();
          runner.reset();
        }
      },
      stop: () => runner.stop(),
      dispose: scope.dispose,
    };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
