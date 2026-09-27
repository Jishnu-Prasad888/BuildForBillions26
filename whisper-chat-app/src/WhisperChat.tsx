import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useWhisperChat } from './hooks/useWhisperChat';
import { useGemmaRag, type LoadStage } from './hooks/useGemmaRag';
import { ChatBubble, type Message } from './components/ChatBubble';
import { LoadingStatus } from './components/LoadingStatus';

export default function WhisperChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const nextIdRef = useRef(0);

  const {
    isModelReady,
    downloadProgress,
    modelError,
    isRecording,
    startRecording,
    stopRecordingAndTranscribe,
  } = useWhisperChat();
  const rag = useGemmaRag();

  const newId = () => `m${nextIdRef.current++}`;

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const updateMessage = (id: string, update: (message: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? update(m) : m)));
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  };

  const notice = (text: string) => addMessage({ id: newId(), role: 'notice', text });

  // The one way a question reaches the assistant, whether it was typed or spoken: voice only fills the box
  // (see handleMicPress), and nothing is sent until this runs.
  const submit = useCallback(async () => {
    const question = draft.trim();
    if (!question || isAnswering || isTranscribing || isRecording) return;

    setDraft('');
    setIsAnswering(true);
    const answerId = newId();
    addMessage({ id: newId(), role: 'user', text: question });
    addMessage({ id: answerId, role: 'assistant', text: '' });

    try {
      const { text, sources } = await rag.ask(question, (token) =>
        updateMessage(answerId, (m) => ({ ...m, text: m.text + token }))
      );
      updateMessage(answerId, (m) => ({ ...m, text: text || '🤷 No answer was generated.', sources }));
    } catch (err: any) {
      updateMessage(answerId, () => ({
        id: answerId,
        role: 'notice',
        text: `⚠️ Could not answer: ${err?.message ?? err}`,
      }));
    } finally {
      setIsAnswering(false);
    }
  }, [draft, isAnswering, isTranscribing, isRecording, rag.ask]);

  // Taps that land while a start/stop is still in flight are ignored: state
  // only updates once it finishes, so they'd otherwise start or stop twice.
  const busyRef = useRef(false);

  const handleMicPress = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    if (!isRecording) {
      try {
        await startRecording();
      } catch (err: any) {
        notice(`⚠️ Could not start recording: ${err?.message ?? err}`);
      } finally {
        busyRef.current = false;
      }
      return;
    }

    setIsTranscribing(true);
    try {
      const text = await stopRecordingAndTranscribe();
      if (text) {
        // Fill the input box (appending to anything already typed) so it can be checked and edited before sending.
        setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      } else {
        notice('🤷 Nothing heard.');
      }
    } catch (err: any) {
      notice(`⚠️ Transcription failed: ${err?.message ?? err}`);
    } finally {
      setIsTranscribing(false);
      busyRef.current = false;
    }
  }, [isRecording, startRecording, stopRecordingAndTranscribe]);

  const stages: LoadStage[] = [
    {
      label: 'Whisper (speech to text)',
      ready: isModelReady,
      progress: downloadProgress, // already 0–100
      error: modelError ?? undefined,
    },
    ...rag.stages,
  ];

  if (!isModelReady || !rag.isReady) {
    return <LoadingStatus stages={stages} />;
  }

  const micLabel = isTranscribing ? '⏳' : isRecording ? '⏹' : '🎤';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <Text style={styles.header}>🎙️ Whisper Chat</Text>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.hint}>
            Ask about crop damage relief, PMFBY, PM-KISAN or KCC relief. Type, or tap 🎤 to speak. Everything runs on this phone.
          </Text>
        }
      />
      <View style={styles.inputRow}>
        <Pressable
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPress={handleMicPress}
          disabled={isTranscribing || isAnswering}
        >
          <Text style={styles.buttonText}>{micLabel}</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={isRecording ? 'Listening… tap ⏹ when done' : 'Ask a question'}
          placeholderTextColor="#8a8a99"
          multiline
          editable={!isRecording && !isTranscribing}
        />
        {isAnswering ? (
          <Pressable style={[styles.sendButton, styles.sendButtonStop]} onPress={() => rag.stop?.()}>
            <Text style={styles.buttonText}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
            onPress={submit}
            disabled={!draft.trim() || isRecording || isTranscribing}
          >
            <Text style={styles.buttonText}>Send</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14' },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    paddingTop: 48,
    paddingBottom: 14,
  },
  list: { padding: 16, flexGrow: 1 },
  hint: { color: '#8a8a99', textAlign: 'center', marginTop: 40, paddingHorizontal: 20, lineHeight: 22 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1f1f2b',
    color: '#fff',
    fontSize: 16,
  },
  micButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: { backgroundColor: '#dc2626' },
  sendButton: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 23,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#26263a' },
  sendButtonStop: { backgroundColor: '#dc2626' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
