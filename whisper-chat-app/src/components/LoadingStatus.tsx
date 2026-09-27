import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { LoadStage } from '../hooks/useGemmaRag';

// The first-launch screen: one row per thing that has to be ready before the assistant works.
export function LoadingStatus({ stages }: { stages: LoadStage[] }) {
  return (
    <View style={styles.center}>
      <StatusBar style="light" />
      <Text style={styles.title}>Getting your offline assistant ready…</Text>
      {stages.map((stage) => {
        const percent = Math.round(stage.progress);
        const status = stage.error
          ? `Failed: ${stage.error.message}`
          : stage.ready
            ? 'Ready'
            : percent > 0 && percent < 100
              ? `${percent}%`
              : 'Loading…';
        const width = stage.ready ? 100 : Math.min(Math.max(percent, 2), 100);
        return (
          <View key={stage.label} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.label}>{stage.label}</Text>
              <Text style={stage.error ? styles.errorText : styles.status}>{status}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, stage.ready && styles.fillDone, stage.error && styles.fillError, { width: `${width}%` }]} />
            </View>
          </View>
        );
      })}
      <Text style={styles.hint}>
        First launch downloads about 3.2 GB (Gemma 4 ~2.6 GB, whisper ~0.45 GB, the search model ~0.1 GB) and then
        indexes the bundled data. It&apos;s cached on-device after this, so from then on everything runs fully offline.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f0f14',
  },
  title: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 24 },
  row: { marginBottom: 18 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { color: '#fff', fontSize: 14 },
  status: { color: '#8a8a99', fontSize: 14 },
  errorText: { color: '#ff6b6b', fontSize: 14, flexShrink: 1, marginLeft: 12, textAlign: 'right' },
  track: { width: '100%', height: 6, borderRadius: 999, backgroundColor: '#26263a', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#4f46e5' },
  fillDone: { backgroundColor: '#22a06b' },
  fillError: { backgroundColor: '#ff6b6b' },
  hint: { color: '#8a8a99', textAlign: 'center', marginTop: 16, paddingHorizontal: 12, lineHeight: 20 },
});
