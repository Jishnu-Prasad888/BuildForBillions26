import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useWhisperChat } from './hooks/useWhisperChat';
import { ChatBubble } from './components/ChatBubble';

type Message = {
  id: string;
  text: string;
};

export default function WhisperChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const {
    isModelReady,
    downloadProgress,
    modelError,
    isRecording,
    startRecording,
    stopRecordingAndTranscribe,
  } = useWhisperChat();

  const addMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, text }]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const handlePress = useCallback(async () => {
    if (!isRecording) {
      try {
        await startRecording();
      } catch (err: any) {
        addMessage(`⚠️ Could not start recording: ${err?.message ?? err}`);
      }
      return;
    }

    setIsTranscribing(true);
    try {
      const text = await stopRecordingAndTranscribe();
      addMessage(text || '🤷 Nothing heard.');
    } catch (err: any) {
      addMessage(`⚠️ Transcription failed: ${err?.message ?? err}`);
    } finally {
      setIsTranscribing(false);
    }
  }, [isRecording, startRecording, stopRecordingAndTranscribe]);

  if (modelError) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.errorText}>
          Failed to load whisper: {String(modelError.message ?? modelError)}
        </Text>
      </View>
    );
  }

  if (!isModelReady) {
    // downloadProgress is already 0–100.
    const percent = Math.round(downloadProgress);
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.loadingText}>
          {percent > 0 && percent < 100
            ? `Downloading whisper… ${percent}%`
            : 'Loading whisper…'}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(Math.max(percent, 2), 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.hint}>
          One-time download (a few hundred MB). It&apos;s cached on-device after
          this, so every transcription afterwards runs fully offline.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.header}>🎙️ Whisper Chat</Text>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble text={item.text} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.hint}>Tap the button below and say something.</Text>
        }
      />
      <Pressable
        style={[styles.recordButton, isRecording && styles.recordButtonActive]}
        onPress={handlePress}
        disabled={isTranscribing}
      >
        <Text style={styles.recordButtonText}>
          {isTranscribing
            ? '⏳ Transcribing…'
            : isRecording
              ? '⏹  Stop'
              : '🎤  Speak'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f0f14',
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    paddingTop: 48,
    paddingBottom: 14,
  },
  list: { padding: 16, flexGrow: 1 },
  hint: { color: '#8a8a99', textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  loadingText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  errorText: { color: '#ff6b6b', textAlign: 'center' },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#26263a',
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#4f46e5' },
  recordButton: {
    margin: 16,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
  },
  recordButtonActive: { backgroundColor: '#dc2626' },
  recordButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
