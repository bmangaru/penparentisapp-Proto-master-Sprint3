// components/PromptHeader.js — the Brainstorm header with today's prompt in it:
//   Brainstorm
//   ● SIMPLE ▾   ↻   ✕
//   "Today's prompt, up to three lines…"            (✎)
// The small row is quiet text in the level colour, but each item has a
// finger-sized tap area. SIMPLE ▾ cycles Simple → Thoughtful → Deep (remembered,
// and shared with the writing page and Home); ↻ refreshes the prompt at that
// level; ✕ hides it (remembered on this phone) and "✦ Show prompt" brings it
// back. The round pencil opens the writing page with this prompt.
// Same prompt all day, new at midnight.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Header } from './ui';
import { colors } from '../theme';
import { LEVEL_LABEL, nextLevel, nextPrompt, promptForDay } from '../prompts';
import usePromptLevel, { LEVEL_STYLE } from './usePromptLevel';
import { useToday } from '../writingStore';

export const PROMPT_HIDDEN_KEY = 'pp.promptHidden.v1';

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
    <Header title={title}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <View style={s.tools}>
            <Pressable
              onPress={() => setLevel(nextLevel(level))}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 4 }}
              style={s.level}
              accessibilityRole="button"
              accessibilityLabel={`Prompt level: ${LEVEL_LABEL[level]}. Tap to change`}
            >
              <View style={[s.dot, { backgroundColor: ls.dot }]} />
              <Text style={[s.levelText, { color: ls.onDark }]}>{LEVEL_LABEL[level].toUpperCase()} ▾</Text>
            </Pressable>
            <Pressable
              onPress={() => setPrompt(nextPrompt(prompt, level))}
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              style={s.tool}
              accessibilityRole="button"
              accessibilityLabel="Refresh prompt"
            >
              <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.75)" />
            </Pressable>
            <Pressable
              onPress={() => setHide(true)}
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 8 }}
              style={s.tool}
              accessibilityRole="button"
              accessibilityLabel="Hide prompt"
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>
          <Text style={s.prompt} numberOfLines={3}>“{prompt}”</Text>
        </View>
        <Pressable
          onPress={() => onWrite(prompt)}
          hitSlop={6}
          style={({ pressed }) => [s.pen, pressed && { transform: [{ scale: 0.95 }] }]}
          accessibilityRole="button"
          accessibilityLabel="Write with this prompt"
        >
          <Ionicons name="pencil" size={19} color={colors.royal} />
        </Pressable>
      </View>
    </Header>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2, marginLeft: -2 },
  level: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28, paddingHorizontal: 2, paddingRight: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  levelText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8 },
  tool: { minWidth: 30, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  prompt: {
    color: '#FFFFFF', fontSize: 15, lineHeight: 21,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  pen: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  show: { borderWidth: 1, borderColor: 'rgba(242,193,78,0.55)', borderRadius: 999, paddingHorizontal: 10, minHeight: 30, justifyContent: 'center' },
  showText: { color: '#F2C14E', fontSize: 12, fontWeight: '700' },
});
