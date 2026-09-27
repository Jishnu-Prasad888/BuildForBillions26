import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'notice';
  text: string;
  /** Passages the answer was built from, best first; the numbers match the [1], [2] the answer cites. */
  sources?: { title: string; source: string }[];
};

export function ChatBubble({ message }: { message: Message }) {
  if (message.role === 'notice') {
    return <Text style={styles.notice}>{message.text}</Text>;
  }

  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      <Text style={styles.label}>{isUser ? 'You' : 'Gemma'}</Text>
      <Text style={styles.text}>{message.text || '…'}</Text>
      {message.sources && message.sources.length > 0 && (
        <View style={styles.sources}>
          <Text style={styles.sourcesTitle}>Sources</Text>
          {message.sources.map((s, i) => (
            <Text key={`${s.source}-${i}`} style={styles.source}>
              [{i + 1}] {s.title}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    maxWidth: '85%',
  },
  userBubble: { backgroundColor: '#1f1f2b', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#26263a', alignSelf: 'flex-start' },
  label: { color: '#8a8aff', fontSize: 11, marginBottom: 4, fontWeight: '600' },
  text: { color: '#fff', fontSize: 16, lineHeight: 22 },
  sources: { marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3a3a52' },
  sourcesTitle: { color: '#8a8a99', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  source: { color: '#8a8a99', fontSize: 12, lineHeight: 17 },
  notice: { color: '#8a8a99', textAlign: 'center', marginBottom: 10, paddingHorizontal: 20 },
});
