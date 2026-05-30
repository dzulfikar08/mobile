import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { sendTerminalInput, useSettingsStore } from '@/state';
import { stringToBase64 } from '@/lib/base64';
import { useTokens } from '@/theme';
import { useSTT } from '../hooks/useSTT';
import { useRecap } from '../hooks/useRecap';
import { isSTTAvailable } from '../services/sttService';
import { isTTSAvailable } from '../services/ttsService';
import { configureVoiceAudioSession } from '../services/audioSession';

type Props = {
  paneId: string;
};

const LONG_PRESS_MS = 500;

export function VoiceButton({ paneId }: Props) {
  const tokens = useTokens();
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const voiceButtonPosition = useSettingsStore((s) => s.voiceButtonPosition);
  const sttLocale = useSettingsStore((s) => s.sttLocale);

  const {
    state: sttState,
    partialText,
    error: sttError,
    start: startSTT,
    stop: stopSTT,
  } = useSTT(sttLocale || undefined);

  const { state: recapState, start: startRecap, cancel: cancelRecap } = useRecap(paneId);

  useEffect(() => {
    if (voiceEnabled) {
      configureVoiceAudioSession();
    }
  }, [voiceEnabled]);

  const isActive = sttState === 'listening' || recapState !== 'idle';

  const pulseScale = useSharedValue(1);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startPulse = useCallback(() => {
    pulseScale.value = withRepeat(
      withSequence(withTiming(1.15, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      false,
    );
  }, [pulseScale]);

  const stopPulse = useCallback(() => {
    pulseScale.value = withTiming(1, { duration: 200 });
  }, [pulseScale]);

  const handlePress = useCallback(async () => {
    if (recapState !== 'idle') {
      cancelRecap();
      return;
    }
    if (sttState === 'listening') {
      const transcript = await stopSTT();
      if (transcript) {
        const base64 = stringToBase64(transcript + '\r');
        sendTerminalInput(paneId, base64);
      }
      stopPulse();
      return;
    }
    await startSTT();
    startPulse();
  }, [sttState, recapState, paneId, startSTT, stopSTT, cancelRecap, startPulse, stopPulse]);

  const handleLongPress = useCallback(async () => {
    if (sttState === 'listening') {
      await stopSTT();
      stopPulse();
    }
    await startRecap();
  }, [sttState, stopSTT, startRecap, stopPulse]);

  if (!voiceEnabled || !isSTTAvailable() || !isTTSAvailable()) return null;

  const iconName =
    recapState !== 'idle'
      ? recapState === 'speaking'
        ? 'volume-high'
        : 'download'
      : 'microphone';

  const bgColor = isActive ? tokens.status.danger : tokens.surface.tertiary;
  const iconColor = isActive ? '#FFFFFF' : tokens.text.muted;

  const positionStyle = voiceButtonPosition === 'left' ? { left: 16 } : { right: 16 };

  return (
    <View style={[styles.container, positionStyle]} pointerEvents="box-none">
      {sttState === 'listening' && partialText ? (
        <View style={[styles.preview, { backgroundColor: tokens.surface.tertiary }]}>
          <Text style={[styles.previewText, { color: tokens.text.secondary }]} numberOfLines={1}>
            {partialText}
          </Text>
        </View>
      ) : null}

      {sttError ? (
        <View style={[styles.preview, { backgroundColor: tokens.surface.tertiary }]}>
          <Text style={[styles.previewText, { color: tokens.status.danger }]} numberOfLines={1}>
            {sttError}
          </Text>
        </View>
      ) : null}

      <Animated.View style={pulseStyle}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={LONG_PRESS_MS}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: bgColor, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <MaterialCommunityIcons name={iconName as any} size={22} color={iconColor} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  preview: {
    maxWidth: 200,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  previewText: {
    fontSize: 12,
  },
});
