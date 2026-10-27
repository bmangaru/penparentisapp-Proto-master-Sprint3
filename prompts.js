// prompts.js — short writing prompts for writer-parents. Pure logic, no React
// Native, so it can be tested in Node.
//
// • promptForDay(key): the same prompt all day, a new one each day (resets at midnight)
// • nextPrompt(current): "Another" — the next one in the list, wrapping around
// Add or edit prompts freely; order doesn't matter.

export const PROMPTS = [
  'Write about the five minutes after the house finally goes quiet.',
  "What did your child ask you today that you couldn't answer?",
  'Describe the kitchen at 7 a.m. using only sounds.',
  'Write a letter to yourself from the year before you became a parent.',
  'A character finds a note in a coat pocket. What does it say?',
  'What did you love doing at age ten that you never do now?',
  'Write the bedtime story you wish someone had told you.',
  'Describe a small fight over something that wasn’t really the problem.',
  'Your child is grown and reading this page. What do you want them to know?',
  'Write about a place you only go to when you need to be alone.',
  'Start with the line: “Nobody told me it would feel like this.”',
  'Describe a stranger you saw today as if they were the main character.',
  'Write about a toy, a blanket or a book your family can’t throw away.',
  'What does your writing time look like, honestly, today?',
  'Write a scene that takes place entirely in a parked car.',
  'Describe a smell that takes you straight back to childhood.',
  'Write about something you’re proud of that nobody noticed.',
  'A parent and a child each tell the same afternoon differently. Write both.',
  'What would you write if you knew no one would ever read it?',
  'Describe the view from the window you look out of most.',
  'Write about the last time you laughed until you couldn’t breathe.',
  'Write a list of ten things in your bag right now, then the story behind one.',
  'What’s a rule in your house that would make no sense to anyone else?',
  'Write about a morning when everything went wrong — then the one thing that went right.',
  'Describe your own parent through one thing they always said.',
  'Write a short poem using only words your child knows.',
  'A door in your home that’s always closed is open. What’s on the other side?',
  'Write about the version of you that exists only after everyone is asleep.',
  'What are you waiting for right now, big or small?',
  'Write the first paragraph of a book you’ll never finish — on purpose.',
];

// Days since a fixed date, from a 'YYYY-MM-DD' key (local calendar day).
function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// The same prompt all day; consecutive days get different prompts.
export function promptForDay(key) {
  const n = PROMPTS.length;
  return PROMPTS[((dayNumber(key) * 7) % n + n) % n];
}

// "Another": the next prompt after `current` (wraps around).
export function nextPrompt(current) {
  const i = PROMPTS.indexOf(current);
  return PROMPTS[(i + 1) % PROMPTS.length];
}
