// links.js — every external URL the app opens, in one place.

export const LINKS = {
  eventbrite: 'https://www.eventbrite.com/o/pen-parentis-4508348063',
  // Salon registration. Points at the organizer page for now — swap in the
  // specific salon series/event URL once the sponsor shares it.
  salonsEventbrite: 'https://www.eventbrite.com/o/pen-parentis-4508348063',
  youtube: 'https://www.youtube.com/penparentis',
  youtubeLive: 'https://www.youtube.com/penparentis/live',
  spotify: 'https://open.spotify.com/show/0kMBhCgKt4p7IbfZdkSXse?si=c67fc4b8dc4f4725',
  discord: 'https://discord.com/invite/D96ryFSsV',
  cycleOfSupport: 'https://airtable.com/appBjCh4HDQeInVw1/shr1Is29b4PPmkMq3/tbl88qRDsxG2wAxCT',
  donate: 'https://secure.givelively.org/donate/pen-parentis/get-karma',
  instagram: 'https://www.instagram.com/penparentis/',
  facebook: 'https://www.facebook.com/PenParentis/',
  linkedin: 'https://www.linkedin.com/company/pen-parentis',
  x: 'https://twitter.com/penparentis',
};

// The Events tab's live list. Eventbrite's API needs a private token, so the
// app never calls Eventbrite directly: it calls a small server function that
// holds the token (see supabase/functions/eventbrite-events). Paste that
// function's URL here once it's deployed. Left empty, the app shows the
// built-in list in eventsService.js.
  export const EVENTS_API_URL = 'https://roxegmihuoezgfhrkesr.supabase.co/functions/v1/eventbrite-events';
