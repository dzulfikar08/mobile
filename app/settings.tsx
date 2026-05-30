import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { HeaderIconButton } from '@/components/HeaderIconButton';
import { useSettingsStore } from '@/state';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const useNerdFont = useSettingsStore((s) => s.useNerdFont);
  const setUseNerdFont = useSettingsStore((s) => s.setUseNerdFont);
  const autoFocusTerminal = useSettingsStore((s) => s.autoFocusTerminal);
  const setAutoFocusTerminal = useSettingsStore((s) => s.setAutoFocusTerminal);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useSettingsStore((s) => s.setVoiceEnabled);
  const ttsRate = useSettingsStore((s) => s.ttsRate);
  const setTtsRate = useSettingsStore((s) => s.setTtsRate);
  const voiceButtonPosition = useSettingsStore((s) => s.voiceButtonPosition);
  const setVoiceButtonPosition = useSettingsStore((s) => s.setVoiceButtonPosition);

  const handleDecreaseTtsRate = () => {
    if (ttsRate > 0.5) setTtsRate(Math.round((ttsRate - 0.1) * 10) / 10);
  };

  const handleIncreaseTtsRate = () => {
    if (ttsRate < 2.0) setTtsRate(Math.round((ttsRate + 0.1) * 10) / 10);
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: tokens.surface.primary }]}
      contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerLeft: () => (
            <HeaderIconButton icon="close" accessibilityLabel="Close" onPress={() => router.back()} />
          ),
        }}
      />

      <Text style={[styles.sectionLabel, { color: tokens.text.muted }]}>Terminal</Text>
      <View
        style={[styles.card, { backgroundColor: tokens.surface.secondary, borderColor: tokens.border.subtle }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>Use Nerd Font</Text>
            <Text style={[styles.rowHint, { color: tokens.text.muted }]}>
              JetBrains Mono with powerline and icon glyphs.
            </Text>
          </View>
          <Switch
            value={useNerdFont}
            onValueChange={setUseNerdFont}
            trackColor={{ true: tokens.accent.primary, false: tokens.surface.tertiary }}
            thumbColor={tokens.surface.primary}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>Auto-focus terminal</Text>
            <Text style={[styles.rowHint, { color: tokens.text.muted }]}>
              Focus the terminal automatically when switching or creating tabs. May open the on-screen keyboard.
            </Text>
          </View>
          <Switch
            value={autoFocusTerminal}
            onValueChange={setAutoFocusTerminal}
            trackColor={{ true: tokens.accent.primary, false: tokens.surface.tertiary }}
            thumbColor={tokens.surface.primary}
          />
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: tokens.text.muted }]}>Voice</Text>
      <View
        style={[styles.card, { backgroundColor: tokens.surface.secondary, borderColor: tokens.border.subtle }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>Voice Commands</Text>
            <Text style={[styles.rowHint, { color: tokens.text.muted }]}>
              Dictate terminal commands and hear Claude Code recaps via speech.
            </Text>
          </View>
          <Switch
            value={voiceEnabled}
            onValueChange={setVoiceEnabled}
            trackColor={{ true: tokens.accent.primary, false: tokens.surface.tertiary }}
            thumbColor={tokens.surface.primary}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>Speech Speed</Text>
            <Text style={[styles.rowHint, { color: tokens.text.muted }]}>
              Adjust how fast recaps are spoken aloud.
            </Text>
          </View>
          <View style={styles.speedControl}>
            <Text style={[styles.speedBound, { color: tokens.text.muted }]}>0.5</Text>
            <Pressable
              onPress={handleDecreaseTtsRate}
              style={[styles.speedButton, { backgroundColor: tokens.surface.tertiary, borderColor: tokens.border.subtle }]}
              accessibilityLabel="Decrease speech speed">
              <Text style={[styles.speedButtonText, { color: tokens.text.primary }]}>-</Text>
            </Pressable>
            <Text style={[styles.speedValue, { color: tokens.text.primary }]}>{ttsRate.toFixed(1)}</Text>
            <Pressable
              onPress={handleIncreaseTtsRate}
              style={[styles.speedButton, { backgroundColor: tokens.surface.tertiary, borderColor: tokens.border.subtle }]}
              accessibilityLabel="Increase speech speed">
              <Text style={[styles.speedButtonText, { color: tokens.text.primary }]}>+</Text>
            </Pressable>
            <Text style={[styles.speedBound, { color: tokens.text.muted }]}>2.0</Text>
          </View>
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>Left-hand Button</Text>
            <Text style={[styles.rowHint, { color: tokens.text.muted }]}>
              Place the voice button on the left side for left-handed use.
            </Text>
          </View>
          <Switch
            value={voiceButtonPosition === 'left'}
            onValueChange={(value) => setVoiceButtonPosition(value ? 'left' : 'right')}
            trackColor={{ true: tokens.accent.primary, false: tokens.surface.tertiary }}
            thumbColor={tokens.surface.primary}
          />
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: tokens.text.muted }]}>Demo</Text>
      <View
        style={[styles.card, { backgroundColor: tokens.surface.secondary, borderColor: tokens.border.subtle }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>Demo Mode</Text>
            <Text style={[styles.rowHint, { color: tokens.text.muted }]}>
              Loads sample data so you can try the app without a desktop. Switching it off restores your real devices.
            </Text>
          </View>
          <Switch
            value={demoMode}
            onValueChange={setDemoMode}
            trackColor={{ true: tokens.accent.primary, false: tokens.surface.tertiary }}
            thumbColor={tokens.surface.primary}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  rowHint: { fontSize: 13 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleText: { flex: 1, gap: 4 },
  speedControl: { alignItems: 'center', gap: 6 },
  speedBound: { fontSize: 12 },
  speedButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButtonText: { fontSize: 18, fontWeight: '600' },
  speedValue: { fontSize: 16, fontWeight: '500', minWidth: 30, textAlign: 'center' },
});
