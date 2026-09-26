import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Both libraries are native modules, so their JS cannot even load inside Expo
// Go — importing them there throws "the native module could not be found".
// Probing for the native module first lets us show that as a message instead of
// a red screen, and keeps the heavy imports out of the way until they can work.
const hasNativeModules =
  (() => {
    try {
      const { NativeModules, TurboModuleRegistry } = require('react-native');
      return (
        NativeModules.AudioAPIModule != null ||
        TurboModuleRegistry.get('AudioAPIModule') != null
      );
    } catch {
      return false;
    }
  })();

export default function App() {
  if (!hasNativeModules) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.title}>⚠️ Development build required</Text>
        <Text style={styles.body}>
          Whisper and the microphone recorder are native modules, so this app
          can&apos;t run in Expo Go.
        </Text>
        <Text style={styles.code}>npm run android</Text>
        <Text style={styles.body}>
          (or <Text style={styles.code}>npm run ios</Text> on a Mac). That
          compiles a development build with the native code included, installs
          it on your phone, and starts the bundler.
        </Text>
      </View>
    );
  }

  // Required lazily: reaching this line means the native module is present, so
  // importing the libraries is safe.
  const WhisperChat = require('./src/WhisperChat').default as React.ComponentType;
  return <WhisperChat />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#0f0f14',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    color: '#8a8a99',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  code: {
    color: '#8a8aff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
  },
});
