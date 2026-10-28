// prompts.js — short writing prompts for writer-parents, in three levels:
//   simple     — everyday and quick to start ("How was your day?")
//   thoughtful — a memory or a small scene
//   deep       — harder, more personal
// Pure logic, no React Native, so it can be tested in Node.
//
// • promptForDay(key, level): the same prompt all day, a new one each day
// • nextPrompt(current, level): "Another" — the next one at that level
// Add or edit prompts freely; order within a level doesn't matter.

export const PROMPT_LEVELS = ['simple', 'thoughtful', 'deep'];
export const LEVEL_LABEL = { simple: 'Simple', thoughtful: 'Thoughtful', deep: 'Deep' };
export const DEFAULT_LEVEL = 'simple';

const BY_LEVEL = {
  simple: [
    'How was your day, in three sentences?',
    'What’s the weather like where you are right now?',
    'What are your plans for the weekend?',
    'What did you eat today? Which bite was best?',
    'Describe the room you’re sitting in.',
    'What made you smile today?',
    'Describe your morning, from waking up to walking out the door.',
    'What song has been stuck in your head lately?',
    'What’s the last thing you bought, and why?',
    'What was your favourite part of today?',
    'What are you looking forward to this week?',
    'What can you hear right now? List every sound.',
    'Who did you talk to today, and what about?',
    'What’s one thing on your to-do list, and how do you feel about it?',
    'Describe what you’re wearing and why you picked it.',
  ],
  thoughtful: [
    'Describe the kitchen at 7 a.m. using only sounds.',
    'A character finds a note in a coat pocket. What does it say?',
    'What did you love doing at age ten that you never do now?',
    'Write the bedtime story you wish someone had told you.',
    'Describe a small fight over something that wasn’t really the problem.',
    'Write about a place you only go to when you need to be alone.',
    'Describe a stranger you saw today as if they were the main character.',
    'Write about a toy, a blanket or a book your family can’t throw away.',
    'What does your writing time look like, honestly, today?',
    'Write a scene that takes place entirely in a parked car.',
    'Describe a smell that takes you straight back to childhood.',
    'Write about the last time you laughed until you couldn’t breathe.',
    'Write a list of ten things in your bag right now, then the story behind one.',
    'What’s a rule in your house that would make no sense to anyone else?',
    'Write about a morning when everything went wrong — then the one thing that went right.',
    'Describe your own parent through one thing they always said.',
    'Write a short poem using only words your child knows.',
    'A door in your home that’s always closed is open. What’s on the other side?',
    'Describe the view from the window you look out of most.',
    'Write the first paragraph of a book you’ll never finish — on purpose.',
  ],
  deep: [
    'Write about the five minutes after the house finally goes quiet.',
    "What did your child ask you today that you couldn't answer?",
    'Write a letter to yourself from the year before you became a parent.',
    'Your child is grown and reading this page. What do you want them to know?',
    'Start with the line: “Nobody told me it would feel like this.”',
    'Write about something you’re proud of that nobody noticed.',
    'A parent and a child each tell the same afternoon differently. Write both.',
    'What would you write if you knew no one would ever read it?',
    'Write about the version of you that exists only after everyone is asleep.',
    'What are you waiting for right now, big or small?',
  ],
};

// Every prompt as { text, level }.
export const PROMPTS = PROMPT_LEVELS.flatMap((level) => BY_LEVEL[level].map((text) => ({ text, level })));

export function normalizeLevel(level) {
  return PROMPT_LEVELS.includes(level) ? level : DEFAULT_LEVEL;
}

export function promptsFor(level) {
  return BY_LEVEL[normalizeLevel(level)];
}

// The level a prompt belongs to (null if it isn't one of ours).
export function levelOf(text) {
  const p = PROMPTS.find((x) => x.text === text);
  return p ? p.level : null;
}

// Simple → Thoughtful → Deep → Simple (for the header chip).
export function nextLevel(level) {
  const i = PROMPT_LEVELS.indexOf(normalizeLevel(level));
  return PROMPT_LEVELS[(i + 1) % PROMPT_LEVELS.length];
}

// Days since a fixed date, from a 'YYYY-MM-DD' key (local calendar day).
function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// The same prompt all day at a level; consecutive days get different prompts.
export function promptForDay(key, level = DEFAULT_LEVEL) {
  const list = promptsFor(level);
  const n = list.length;
  // A step that shares no factor with n visits every prompt before repeating.
  let step = 7;
  while (gcd(step, n) !== 1) step += 1;
  return list[((dayNumber(key) * step) % n + n) % n];
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

// "Another": the next prompt after `current` at that level (wraps around).
export function nextPrompt(current, level = DEFAULT_LEVEL) {
  const list = promptsFor(level);
  const i = list.indexOf(current);
  return list[(i + 1) % list.length];
}
