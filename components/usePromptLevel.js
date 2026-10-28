// components/usePromptLevel.js — the prompt level you picked (Simple,
// Thoughtful or Deep), saved on this phone and shared by every screen: change
// it in the Brainstorm header and the writing page and Home follow.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LEVEL, normalizeLevel } from '../prompts';

export const PROMPT_LEVEL_KEY = 'pp.promptLevel.v1';

// Level colours: green = Simple, gold = Thoughtful, violet = Deep.
//   bg/fg — the small level chip
//   tint  — the prompt card on the writing page
//   solid — its left edge, and the ✦ Prompt button while a prompt is open
export const LEVEL_STYLE = {
  simple: { bg: '#E6F6EA', fg: '#1E7B3A', tint: '#EEF8F0', solid: '#2E9150' },
  thoughtful: { bg: '#FFF4D6', fg: '#8A5E12', tint: '#FFF6DF', solid: '#C8912B' },
  deep: { bg: '#EDE7FF', fg: '#4B3FB8', tint: '#F1ECFF', solid: '#6B5BD6' },
};

let current = null; // in-memory copy
const listeners = new Set();

async function read() {
  if (current) return current;
  try {
    current = normalizeLevel(await AsyncStorage.getItem(PROMPT_LEVEL_KEY));
  } catch {
    current = DEFAULT_LEVEL;
  }
  return current;
}

export function setPromptLevel(level) {
  current = normalizeLevel(level);
  AsyncStorage.setItem(PROMPT_LEVEL_KEY, current).catch(() => {});
  for (const fn of listeners) fn(current);
}

// [level, setLevel]
export default function usePromptLevel() {
  const [level, setLevel] = useState(current || DEFAULT_LEVEL);
  useEffect(() => {
    let live = true;
    read().then((l) => live && setLevel(l));
    listeners.add(setLevel);
    return () => { live = false; listeners.delete(setLevel); };
  }, []);
  return [level, setPromptLevel];
}
