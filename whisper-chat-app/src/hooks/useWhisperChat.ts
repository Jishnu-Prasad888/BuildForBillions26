import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioRecorder,
  AudioManager,
  OfflineAudioContext,
} from 'react-native-audio-api';
import { useSpeechToText, models, WHISPER_SAMPLE_RATE_HZ } from 'react-native-executorch';

// English-only whisper-small: the transcription below is pinned to English, and
// this variant is a much smaller download (~450 MB instead of ~1.1 GB) and a bit
// faster, because it doesn't carry the other 98 languages.
//
// Swap freely if you need something else:
//   models.speechToText.WHISPER.EN.TINY.DEFAULT  (fastest, ~220 MB)
//   models.speechToText.WHISPER.SMALL.DEFAULT   (multilingual, needs a real language code)
const STT_MODEL = models.speechToText.WHISPER.EN.SMALL.DEFAULT;
const LANGUAGE = 'en';

// Whisper processes audio in 29-second windows, so a very long recording is
// transcribed as a series of independent windows. Anything past this is dropped
// instead of holding hundreds of MB of PCM in JS memory.
const MAX_RECORDING_SECONDS = 60;

// Lets events already queued for the JS thread (like the final audio chunk
// flushed by recorder.stop()) run before we read what was captured.
const flushPendingEvents = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

// The recorder asks for 16 kHz mono, but the OS may hand back a different rate.
// Whisper needs exactly 16 kHz, so anything else has to be resampled first —
// otherwise it just returns garbage.
async function resampleToWhisperRate(
  samples: Float32Array<ArrayBuffer>,
  fromRate: number
): Promise<Float32Array<ArrayBuffer>> {
  if (fromRate === WHISPER_SAMPLE_RATE_HZ) return samples;

  const length = Math.round(
    (samples.length * WHISPER_SAMPLE_RATE_HZ) / fromRate
  );
  const context = new OfflineAudioContext(1, length, WHISPER_SAMPLE_RATE_HZ);
  const buffer = context.createBuffer(1, samples.length, fromRate);
  buffer.copyToChannel(samples, 0);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();

  return (await context.startRendering()).getChannelData(0).slice();
}

export function useWhisperChat() {
  const stt = useSpeechToText(STT_MODEL);
  const { transcribe } = stt;

  const [isRecording, setIsRecording] = useState(false);

  // One recorder for the whole app, as the library recommends: swapping
  // instances costs memory and battery.
  const recorderRef = useRef<AudioRecorder | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const capturedSecondsRef = useRef(0);
  const sampleRateRef = useRef(WHISPER_SAMPLE_RATE_HZ);

  // Stop the microphone if the screen goes away mid-recording.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (!recorder) return;
      recorder.clearOnAudioReady();
      if (recorder.isRecording()) void recorder.stop();
      void AudioManager.setAudioSessionActivity(false).catch(() => {});
    };
  }, []);

  const startRecording = useCallback(async () => {
    // Guards against a double tap opening a second input session.
    if (recorderRef.current?.isRecording()) return;

    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== 'Granted') {
      throw new Error('Microphone permission was not granted.');
    }

    // iOS needs an active "record" session for the mic to deliver samples.
    AudioManager.setAudioSessionOptions({
      iosCategory: 'record',
      iosMode: 'default',
      iosOptions: [],
    });
    await AudioManager.setAudioSessionActivity(true);

    chunksRef.current = [];
    capturedSecondsRef.current = 0;
    sampleRateRef.current = WHISPER_SAMPLE_RATE_HZ;

    const recorder = recorderRef.current ?? new AudioRecorder();
    recorderRef.current = recorder;

    // react-native-audio-api hands us raw float32 PCM, which is exactly the
    // format Whisper wants — no audio file, no decoding, no resaving.
    const callbackResult = recorder.onAudioReady(
      {
        sampleRate: WHISPER_SAMPLE_RATE_HZ,
        bufferLength: WHISPER_SAMPLE_RATE_HZ * 0.5, // ~0.5s chunks
        channelCount: 1,
      },
      ({ buffer }) => {
        // Capped by duration, not chunk count: the device may not honour the
        // requested buffer length.
        if (capturedSecondsRef.current >= MAX_RECORDING_SECONDS) return;
        chunksRef.current.push(buffer.getChannelData(0).slice());
        capturedSecondsRef.current += buffer.duration;
        sampleRateRef.current = buffer.sampleRate;
      }
    );

    const result =
      callbackResult.status === 'error' ? callbackResult : await recorder.start();
    if (result.status === 'error') {
      recorder.clearOnAudioReady();
      await AudioManager.setAudioSessionActivity(false).catch(() => {});
      throw new Error(result.message);
    }

    setIsRecording(true);
  }, []);

  const stopRecordingAndTranscribe = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return '';

    // Stop before clearing the callback: stop() is what flushes the final
    // partial chunk through it, so clearing first drops the tail of the speech.
    let result: Awaited<ReturnType<AudioRecorder['stop']>>;
    try {
      result = await recorder.stop();
      await flushPendingEvents();
    } finally {
      recorder.clearOnAudioReady();
      setIsRecording(false);
      await AudioManager.setAudioSessionActivity(false).catch(() => {
        // Session teardown is best-effort — the recording is already captured.
      });
    }

    if (result.status === 'error') {
      throw new Error(result.message);
    }

    const chunks = chunksRef.current;
    const sampleRate = sampleRateRef.current;
    chunksRef.current = [];

    if (chunks.length === 0) return '';
    if (!transcribe) throw new Error('Whisper is not loaded yet.');

    // Stitch the chunks into one waveform for a single transcription pass.
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const recorded = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      recorded.set(chunk, offset);
      offset += chunk.length;
    }

    const audio = await resampleToWhisperRate(recorded, sampleRate);
    return (await transcribe(audio, { language: LANGUAGE })).trim();
  }, [transcribe]);

  return {
    isModelReady: stt.isReady,
    // 0–100, straight from the library — no scaling needed.
    downloadProgress: stt.downloadProgress,
    modelError: stt.error,
    isRecording,
    startRecording,
    stopRecordingAndTranscribe,
  };
}
