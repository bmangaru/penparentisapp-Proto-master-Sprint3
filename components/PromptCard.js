// components/PromptCard.js — "Today's prompt", shown on Home and Brainstorm.
// The same prompt all day (it changes at midnight); "Refresh" swaps it.
// The level chip (Simple / Thoughtful / Deep) is shared with Brainstorm.
// "Write with this" calls onWrite(prompt).

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { colors, lift, radius } from '../theme';
import { LEVEL_LABEL, nextLevel, nextPrompt, promptForDay } from '../prompts';
import usePromptLevel, { LEVEL_STYLE } from './usePromptLevel';
import { useToday } from '../writingStore';

export default function PromptCard({ onWrite }) {
  const today = useToday();
  const [level, setLevel] = usePromptLevel();
  const [prompt, setPrompt] = useState(promptForDay(today, level));
  useEffect(() => { setPrompt(promptForDay(today, level)); }, [today, level]);
  const ls = LEVEL_STYLE[level];

  return (
    <View style={[s.card, lift]}>
      <View style={s.head}>
        <Text style={s.kick}>✦ TODAY'S PROMPT</Text>
        <Pressable
          onPress={() => setLevel(nextLevel(level))}
          hitSlop={6}
          style={[s.level, { backgroundColor: ls.bg }]}
          accessibilityRole="button"
          accessibilityLabel={`Prompt level: ${LEVEL_LABEL[level]}. Tap to change`}
        >
          <Text style={[s.levelText, { color: ls.fg }]}>{LEVEL_LABEL[level]} ▾</Text>
        </Pressable>
      </View>
      <Text style={s.text}>“{prompt}”</Text>
      <View style={s.row}>
        <Pressable onPress={() => onWrite(prompt)} style={[s.btn, s.btnMain]} accessibilityRole="button">
          <Text style={[s.btnText, { color: '#FFFFFF' }]}>Write with this</Text>
        </Pressable>
        <Pressable onPress={() => setPrompt(nextPrompt(prompt, level))} style={s.btn} accessibilityRole="button" accessibilityLabel="Refresh prompt">
          <Text style={s.btnText}>↻  Refresh</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.karmaLight, borderRadius: radius.lg, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  level: { borderRadius: 999, paddingHorizontal: 10, minHeight: 26, justifyContent: 'center' },
  levelText: { fontSize: 11.5, fontWeight: '800' },
  kick: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: '#8A5E12' },
  text: {
    fontSize: 16.5, lineHeight: 24, color: colors.ink, marginTop: 6, marginBottom: 12,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.royal,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
  btnMain: { backgroundColor: colors.royal },
  btnText: { fontSize: 13.5, fontWeight: '700', color: colors.royal },
});
