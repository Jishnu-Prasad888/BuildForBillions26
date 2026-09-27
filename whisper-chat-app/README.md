# Whisper Chat (on-device whisper + Gemma 4 RAG)

An Expo/React Native app that answers questions about government schemes
**entirely on-device, with no network after the first launch**. You type a
question, or speak it and `whisper-small` fills the input box; then **Gemma 4
E2B** answers from a small knowledge base bundled inside the app (retrieval-
augmented generation, RAG). This folder is a complete, runnable project — the
app files plus all the config needed to build it.

## How it works

- **[react-native-executorch](https://docs.swmansion.com/react-native-executorch/)**
  (Software Mansion) runs all three models on-device via Meta's ExecuTorch
  runtime, and downloads/caches the model weights for you:
  - `whisper-small` (English) — speech to text
  - `all-MiniLM-L6-v2` — turns passages and questions into vectors for search
  - `Gemma 4 E2B` (8-bit/4-bit quantized) — writes the answer from the retrieved passages
- **[react-native-audio-api](https://docs.swmansion.com/react-native-audio-api/)**
  captures the microphone as raw 16 kHz mono float32 PCM — the exact format
  Whisper wants, so there's no audio file or format conversion involved.

```
speak:  mic ──► AudioRecorder ──► PCM ──► whisper ──► fills the input box ─┐
type:   ───────────────────────────────────────────► the input box ────────┤
                                                                            ▼ Send
question ──► MiniLM vector + keyword search over assets/corpus.json ──► top 4 passages
         ──► Gemma 4 (fresh context each question) ──► streamed answer + numbered sources
```

Typed and spoken questions take the same path: voice only fills the box, and
nothing is sent until you tap **Send**.

## Requirements

- A **physical iPhone or Android phone** (simulators are slow for on-device ML,
  and the iOS simulator has no real microphone).
- iOS 17+ / Android 8.0+ (`minSdkVersion` 26 — already set in `app.json`).
- A **development build** is required; this will **not** run in Expo Go, because
  both libraries ship native code.
- **~3.5 GB free storage** for the one-time model downloads (Gemma 4 ~2.6 GB,
  whisper ~0.45 GB, MiniLM ~0.1 GB), cached afterwards.
- **A high-memory phone (about 8 GB RAM is my expectation, not measured).** Gemma,
  whisper and the embedder are all loaded at once. If the app is killed while
  loading, try `WHISPER.EN.TINY` (see below) or a phone with more RAM.
- Node 20+ and npm. Apple silicon Mac + Xcode for iOS; Android Studio for Android.

## Install and run

```bash
npm install
npm run ios       # or: npm run android
```

First launch downloads the three models (about 3.2 GB, so use Wi-Fi), shows a
progress bar for each, then embeds the bundled data once (a few seconds) and
saves the vectors on the device. From then on **everything runs fully offline**,
including the first answer after a restart.

If the build complains about missing native artifacts
(`Build input files cannot be found`), the executorch postinstall was skipped:

```bash
npm rebuild react-native-executorch
```

## Using it

Type a question and tap **Send**, or tap **🎤**, speak, and tap **⏹** — a few
seconds later the transcription appears in the input box, where you can fix it
before sending. The answer streams in, followed by the numbered passages it
used (`[1]`, `[2]`… match the numbers in the answer). **Stop** cuts a long
answer short. If the bundled data doesn't cover the question, the assistant
says it can't verify the answer instead of guessing. Recording is capped at 60
seconds, which Whisper splits into its own 29-second windows internally.

Only English is supported: the speech model and the search model are both
English-only, and the bundled data is English.

## The data (what it can answer)

The knowledge base is `assets/corpus.json`, generated from the repo's `data/`
folder: the two demo advisories in `data/documents`, the scheme summaries,
situations and document names in `data/seed/graph.json`, and the demo form in
`data/seed/forms`. **`data/users` (citizens' uploaded forms) is never read.**
It is about 8.5 KB, so today it covers four crop-damage schemes (crop loss
relief, PMFBY, PM-KISAN, KCC calamity relief) plus the field-survey and
hailstorm advisories.

After changing anything in `data/`, rebuild it and rebuild the app:

```bash
python3 scripts/build_corpus.py     # needs pdftotext (poppler-utils) or PyMuPDF for the PDFs
```

The app fingerprints the corpus: on the next launch it notices the change,
re-embeds and re-saves the vectors by itself. To use more data (for example the
`scheme/` folder) point the script's `from_*` functions at it.

## Project layout

| File | What it does |
| --- | --- |
| `App.tsx` | Entry guard: if the native modules are missing (Expo Go), it explains how to build a dev build |
| `src/WhisperChat.tsx` | Screen: message list, input box, mic and Send buttons. Typed and spoken questions both go through `submit` |
| `src/hooks/useWhisperChat.ts` | Loads whisper, records the mic, transcribes |
| `src/hooks/useGemmaRag.ts` | Loads Gemma 4 and the embedder, builds the index, exposes `ask(question, onToken)` |
| `src/rag/chunker.ts` | Cuts the corpus into ~700-character passages |
| `src/rag/vectorIndex.ts` | Embeds the passages once and saves the vectors on the device |
| `src/rag/retrieve.ts` | Finds the best passages: vector similarity fused with keyword matching |
| `src/rag/prompt.ts` | The grounded prompt and the context-window budget |
| `src/rag/answerSession.ts` | One Gemma question at a time, from an empty context (the library's chat session would keep old passages) |
| `src/components/ChatBubble.tsx` | One message bubble (you / Gemma / notice) with its sources |
| `src/components/LoadingStatus.tsx` | First-launch screen: one progress row per model and the index |
| `assets/corpus.json` | The bundled knowledge base (generated, committed) |
| `scripts/build_corpus.py` | Regenerates `assets/corpus.json` from `data/` |
| `app.json` | Microphone permissions, iOS 17 target, Android `minSdkVersion` 26 |
| `index.ts` | Expo entry point |

## Tweaking the models

Gemma 4 E2B is the smallest Gemma 4 that `react-native-executorch` ships; the
models are constants at the top of `src/hooks/useGemmaRag.ts`. Retrieval and
answer length are constants there too (`TOP_K`, `MAX_NEW_TOKENS`,
`TEMPERATURE`), and `MIN_COSINE` in `src/rag/retrieve.ts` decides how similar a
passage must be to count as relevant — raise it if off-topic questions still get
sources, lower it if on-topic ones get none.

The speech model is one line in `src/hooks/useWhisperChat.ts`:

```ts
const STT_MODEL = models.speechToText.WHISPER.EN.SMALL.DEFAULT;
const LANGUAGE = 'en';
```

| Swap to | Download | Notes |
| --- | --- | --- |
| `WHISPER.EN.TINY.DEFAULT` | ~220 MB | Fastest, good enough for testing |
| `WHISPER.EN.BASE.DEFAULT` | ~400 MB | Lighter than small, more accurate than tiny |
| `WHISPER.SMALL.DEFAULT` | ~1.1 GB | Multilingual — set `LANGUAGE` to any of the 99 codes |

`DEFAULT` picks Core ML on iOS and XNNPACK on Android automatically. You can
also pin a backend explicitly (e.g. `WHISPER.EN.SMALL.COREML_FP16`).

For word-by-word text while you talk, use the `stream()` / `streamInsert()` API
instead of `transcribe()` — see the
[Speech-to-Text docs](https://docs.swmansion.com/react-native-executorch/docs/extensions/speech-to-text).

## Integrating into your own project

The source files are self-contained, so copy them in:

```
App.tsx                                 (dev-build guard, keep it or merge it away)
src/WhisperChat.tsx                     (the screen)
src/hooks/useWhisperChat.ts
src/hooks/useGemmaRag.ts
src/rag/                                (chunker, vectorIndex, retrieve, prompt, answerSession)
src/components/ChatBubble.tsx
src/components/LoadingStatus.tsx
assets/corpus.json                      (or generate your own with scripts/build_corpus.py)
```

Then make sure your app has the same setup:

1. **Dependencies** — `react-native-executorch` needs
   `react-native-worklets >=0.10 <0.13` and `react-native-blob-util ^0.24`;
   `react-native-audio-api` needs `react-native-worklets >=0.7`:

   ```bash
   npx expo install react-native-executorch react-native-audio-api \
     react-native-blob-util react-native-worklets expo-build-properties
   ```

   Executorch only supports the New Architecture with React Native 0.83+ /
   Expo SDK 55+ (SDK 54 and below cannot work — its worklets version is too old).

2. **`app.json` plugins** — merge these into your existing `plugins` array:

   ```json
   [
     "react-native-audio-api",
     {
       "iosMicrophonePermission": "Whisper Chat needs the microphone to transcribe your speech.",
       "androidPermissions": [
         "android.permission.RECORD_AUDIO",
         "android.permission.MODIFY_AUDIO_SETTINGS"
       ],
       "iosBackgroundMode": false,
       "androidForegroundService": false,
       "androidFSTypes": []
     }
   ],
   [
     "expo-build-properties",
     { "android": { "minSdkVersion": 26 } }
   ]
   ```

   `iosBackgroundMode` / `androidForegroundService` are only needed if you record
   while the app is in the background — off here keeps the build lean.

3. **iOS 17+** — set `expo.ios.deploymentTarget` to `"17.0"`, otherwise
   `pod install` warns and the build fails later. iOS also needs an arm64 Mac;
   the library ships no x86_64 simulator slice.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Failed to install react-native-audio-api: The native module could not be found` | You're in Expo Go, which doesn't ship these native modules. Run `npm run android` (or `npm run ios`) to build a development build. |
| "Expo Go" can't open it | Expected — use a dev build (`npm run ios` / `npm run android`) |
| `Build input files cannot be found ... XnnpackBackend` | `npm rebuild react-native-executorch` |
| `Headers/Types.h` build error | A pod is building as a framework (`use_frameworks!`). Force `react-native-executorch` back to a static library in your `Podfile`; Expo SDK 55+ does this for you already. |
| Android crash on load | `minSdkVersion` under 26, or an unsupported ABI — keep `arm64-v8a` and `x86_64` in `android/gradle.properties` |
| Progress bar stuck / a row shows `Failed: …` | First launch needs internet to fetch the models; a failed download surfaces as an error on that model's row |
| App is killed while loading, or Gemma never finishes loading | Out of memory: three models are loaded at once. Use a phone with more RAM, or a smaller whisper (`WHISPER.EN.TINY`) |
| Gemma fails to load only on Android GPU | `DEFAULT` prefers the Vulkan build there. Pin `models.llm.GEMMA4_E2B.XNNPACK_8DA4W` in `src/hooks/useGemmaRag.ts` |
| Every answer says it "cannot verify" | The question isn't covered by `assets/corpus.json`, or `MIN_COSINE` is too high. Check the `[rag]` lines in the Metro log |
| `[rag] dropped N source(s)` in the log | The model's context window is smaller than the passages; only the best fit are sent. Lower `TOP_K` |
| Transcribed text is nonsense | The mic returned a non-16 kHz rate. The hook resamples automatically; if you replace it, keep that conversion. |
| Install/build errors | Almost always a version mismatch — check the [compatibility page](https://docs.swmansion.com/react-native-executorch/docs/other/compatibility) |

## Android build settings (Linux)

`android/` is generated by `npm run android` (Expo prebuild) and is git-ignored, so a fresh clone gets Expo's
defaults, not the settings the app was developed with. These are the local overrides from the Linux machine it
was developed on (Node 22, OpenJDK 21). They are **not verified by CI**. Apply them only if your Android build
runs out of memory, hangs, or fails on the Gradle version.

| File (inside `android/`) | Generated default | Developed with |
| --- | --- | --- |
| `gradle.properties` → `org.gradle.jvmargs` | `-Xmx2048m -XX:MaxMetaspaceSize=512m` | `-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8 -Djdk.lang.Process.launchMechanism=VFORK` |
| `gradle.properties` → `org.gradle.parallel` | `true` | `false` |
| `gradle.properties` | *(not set)* | `kotlin.compiler.execution.strategy=in-process` |
| `gradle/wrapper/gradle-wrapper.properties` → `distributionUrl` | `.../gradle-9.3.1-bin.zip` | `.../gradle-8.14.3-bin.zip` |

Things to know:

- **`-Djdk.lang.Process.launchMechanism=VFORK` is Linux-only.** Leave it out on macOS and Windows.
- **`npx expo prebuild --clean` regenerates `android/`** and discards these edits, so re-apply them afterwards.
- **`android/local.properties` is specific to your machine** (it holds your Android SDK path as `sdk.dir`). Never
  commit it. Setting `ANDROID_HOME` to your SDK folder is the alternative to creating it.
- A 4 GB Gradle heap needs a machine with enough free RAM; lower `-Xmx` if the build gets killed.
