import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ChatBubble({ text }: { text: string }) {
  return (
    <View style={styles.bubble}>
      <Text style={styles.label}>You said</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: '#1f1f2b',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  label: { color: '#8a8aff', fontSize: 11, marginBottom: 4, fontWeight: '600' },
  text: { color: '#fff', fontSize: 16, lineHeight: 22 },
});
