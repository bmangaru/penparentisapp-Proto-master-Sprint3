// components/PromptHeader.js — the Brainstorm header with today's prompt in it:
//   Brainstorm         Simple ▾   ↻  ✕
//   ✦ "Today's prompt, up to two lines…"   ✎ Write
// The level chip switches Simple → Thoughtful → Deep (remembered, and shared
// with the writing page and Home). ↻ shows another prompt at that level.
// ✕ hides it (remembered on this phone, even after closing the app), and
// "✦ Show prompt" brings it back. Same prompt all day, new at midnight.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Header } from './ui';
import { colors } from '../theme';
import { LEVEL_LABEL, nextLevel, nextPrompt, promptForDay } from '../prompts';
import usePromptLevel, { LEVEL_STYLE } from './usePromptLevel';
import { useToday } from '../writingStore';

export const PROMPT_HIDDEN_KEY = 'pp.promptHidden.v1';

function Round({ label, onPress, children }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={s.round} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={s.roundText}>{children}</Text>
    </Pressable>
  );
}

export default function PromptHeader({ title, onWrite }) {
  const today = useToday();
  const [level, setLevel] = usePromptLevel();
  const [prompt, setPrompt] = useState(promptForDay(today, level));
  const [hidden, setHidden] = useState(false);
  useEffect(() => { setPrompt(promptForDay(today, level)); }, [today, level]);
  const ls = LEVEL_STYLE[level];
  useEffect(() => {
    AsyncStorage.getItem(PROMPT_HIDDEN_KEY).then((v) => setHidden(v === '1')).catch(() => {});
  }, []);

  function setHide(v) {
    setHidden(v);
    AsyncStorage.setItem(PROMPT_HIDDEN_KEY, v ? '1' : '0').catch(() => {});
  }

  if (hidden) {
    return (
      <Header
        title={title}
        right={
          <Pressable onPress={() => setHide(false)} hitSlop={6} style={s.show} accessibilityRole="button">
            <Text style={s.showText}>✦ Show prompt</Text>
          </Pressable>
        }
      />
    );
  }

  return (
    <Header
      title={title}
      right={
        <View style={s.rounds}>
          <Pressable
            onPress={() => setLevel(nextLevel(level))}
            hitSlop={6}
            style={[s.level, { backgroundColor: ls.bg }]}
            accessibilityRole="button"
            accessibilityLabel={`Prompt level: ${LEVEL_LABEL[level]}. Tap to change`}
          >
            <Text style={[s.levelText, { color: ls.fg }]}>{LEVEL_LABEL[level]} ▾</Text>
          </Pressable>
          <Round label="Another prompt" onPress={() => setPrompt(nextPrompt(prompt, level))}>↻</Round>
          <Round label="Hide prompt" onPress={() => setHide(true)}>✕</Round>
        </View>
      }
    >
      <View style={s.row}>
        <Text style={s.prompt} numberOfLines={2}>
          <Text style={s.spark}>✦ </Text>“{prompt}”
        </Text>
        <Pressable onPress={() => onWrite(prompt)} style={s.write} accessibilityRole="button" accessibilityLabel="Write with this prompt">
          <Text style={s.writeText}>✎ Write</Text>
        </Pressable>
      </View>
    </Header>
  );
}

const s = StyleSheet.create({
  rounds: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  level: { borderRadius: 999, paddingHorizontal: 10, minHeight: 28, justifyContent: 'center' },
  levelText: { fontSize: 11.5, fontWeight: '800' },
  round: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  roundText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  prompt: {
    flex: 1, color: '#FFFFFF', fontSize: 14, lineHeight: 19,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  spark: { color: '#F2C14E', fontWeight: '800' },
  write: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, minHeight: 34, justifyContent: 'center' },
  writeText: { color: colors.royal, fontSize: 12.5, fontWeight: '700' },
  show: { borderWidth: 1, borderColor: 'rgba(242,193,78,0.55)', borderRadius: 999, paddingHorizontal: 10, minHeight: 30, justifyContent: 'center' },
  showText: { color: '#F2C14E', fontSize: 12, fontWeight: '700' },
});
