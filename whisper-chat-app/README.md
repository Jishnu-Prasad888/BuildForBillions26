# Whisper Chat (on-device whisper-small)

An Expo/React Native app that records your voice and transcribes it **entirely
on-device** with OpenAI's `whisper-small`, showing each transcription as a chat
bubble. This folder is a complete, runnable project — the app files plus all the
config needed to build it.

Worth knowing up front: whisper-small is a **speech-to-text** model, not a
conversational one. It can't reply to you — it only turns speech into text. So
this app is really "talk and see it transcribed, in a chat-style log."

## How it works

- **[react-native-executorch](https://docs.swmansion.com/react-native-executorch/)**
  (Software Mansion) runs `whisper-small` on-device via Meta's ExecuTorch
  runtime, and downloads/caches the model weights for you.
- **[react-native-audio-api](https://docs.swmansion.com/react-native-audio-api/)**
  captures the microphone as raw 16 kHz mono float32 PCM — the exact format
  Whisper wants, so there's no audio file or format conversion involved.

```
mic ──► AudioRecorder ──► 0.5s PCM chunks ──► stitch ──► stt.transcribe() ──► chat bubble
```

## Requirements

- A **physical iPhone or Android phone** (simulators are slow for on-device ML,
  and the iOS simulator has no real microphone).
- iOS 17+ / Android 8.0+ (`minSdkVersion` 26 — already set in `app.json`).
- A **development build** is required; this will **not** run in Expo Go, because
  both libraries ship native code.
- ~500 MB free space for the one-time model download (cached afterwards).
- Node 20+ and npm. Apple silicon Mac + Xcode for iOS; Android Studio for Android.

## Install and run

```bash
npm install
npm run ios       # or: npm run android
```

First launch downloads whisper (~450 MB for the English-only small model) and
shows a progress bar. After that it's cached on-device and every transcription
runs fully offline.

If the build complains about missing native artifacts
(`Build input files cannot be found`), the executorch postinstall was skipped:

```bash
npm rebuild react-native-executorch
```

## Using it

Tap **🎤 Speak**, say something, tap **⏹ Stop**. A few seconds later the text
appears as a chat bubble. Repeat to build up a log. Recording is capped at 60
seconds, which Whisper splits into its own 29-second windows internally.

## Project layout

| File | What it does |
| --- | --- |
| `App.tsx` | Entry guard: if the native modules are missing (Expo Go), it explains how to build a dev build |
| `src/WhisperChat.tsx` | Screen: model download state, message list, record button |
| `src/hooks/useWhisperChat.ts` | Loads the model, records the mic, transcribes |
| `src/components/ChatBubble.tsx` | One transcribed message bubble |
| `app.json` | Microphone permissions, iOS 17 target, Android `minSdkVersion` 26 |
| `index.ts` | Expo entry point |

## Tweaking the model

The model is one line in `src/hooks/useWhisperChat.ts`:

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
src/components/ChatBubble.tsx
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
| Progress bar stuck / `modelError` set | First launch needs internet to fetch the model; a failed download surfaces as an error on screen |
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
