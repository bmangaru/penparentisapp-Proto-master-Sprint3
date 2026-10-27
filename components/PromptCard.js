// components/PromptCard.js — "Today's prompt", shown on Home and Brainstorm.
// The same prompt all day (it changes at midnight); "Another" swaps it.
// "Write with this" calls onWrite(prompt).

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { colors, lift, radius } from '../theme';
import { nextPrompt, promptForDay } from '../prompts';
import { useToday } from '../writingStore';

export default function PromptCard({ onWrite }) {
  const today = useToday();
  const [prompt, setPrompt] = useState(promptForDay(today));
  useEffect(() => { setPrompt(promptForDay(today)); }, [today]);

  return (
    <View style={[s.card, lift]}>
      <Text style={s.kick}>✦ TODAY'S PROMPT</Text>
      <Text style={s.text}>“{prompt}”</Text>
      <View style={s.row}>
        <Pressable onPress={() => onWrite(prompt)} style={[s.btn, s.btnMain]} accessibilityRole="button">
          <Text style={[s.btnText, { color: '#FFFFFF' }]}>Write with this</Text>
        </Pressable>
        <Pressable onPress={() => setPrompt(nextPrompt(prompt))} style={s.btn} accessibilityRole="button" accessibilityLabel="Another prompt">
          <Text style={s.btnText}>↻  Another</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.karmaLight, borderRadius: radius.lg, padding: 14 },
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
