// supabase/functions/eventbrite-events/index.ts
//
// Returns Pen Parentis's upcoming Eventbrite events as small JSON for the app:
//   { events: [{ id, name, start, end, online, venue, url, summary }] }
//
// Why a server function: Eventbrite's API needs a private token. Putting it in
// the app would let anyone pull it out of the download, so it lives here.
//
// Deploy (one time):
//   supabase secrets set EVENTBRITE_TOKEN=<private token from eventbrite.com/platform/api-keys>
//   supabase functions deploy eventbrite-events --no-verify-jwt
// Then paste the function URL into EVENTS_API_URL in links.js.

const ORGANIZER_ID = "4508348063"; // eventbrite.com/o/pen-parentis-4508348063
const API = `https://www.eventbriteapi.com/v3/organizers/${ORGANIZER_ID}/events/`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// deno-lint-ignore no-explicit-any
function trim(e: any) {
  return {
    id: e.id,
    name: e.name?.text ?? "Pen Parentis event",
    start: e.start?.utc,
    end: e.end?.utc,
    online: !!e.online_event,
    venue: e.venue?.name ?? (e.online_event ? "Online" : ""),
    url: e.url,
    summary: e.summary ?? "",
  };
}

// Eventbrite rejects some option combinations on this endpoint, so try a few,
// simplest last, and use the first that works.
const ATTEMPTS = [
  "status=live&order_by=start_asc&expand=venue",
  "order_by=start_asc&expand=venue",
  "expand=venue",
  "",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const token = Deno.env.get("EVENTBRITE_TOKEN");
  if (!token) return Response.json({ error: "EVENTBRITE_TOKEN not set" }, { status: 500, headers: CORS });

  const errors: unknown[] = [];
  for (const query of ATTEMPTS) {
    const res = await fetch(`${API}${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Keep Eventbrite's own explanation so problems are easy to read.
      let detail: unknown = null;
      try { detail = await res.json(); } catch { /* not JSON */ }
      errors.push({ query, status: res.status, detail });
      continue;
    }
    const body = await res.json();
    const now = Date.now();
    const events = (body.events ?? [])
      .map(trim)
      .filter((e: { start?: string; end?: string }) => e.start && new Date(e.end ?? e.start).getTime() >= now)
      .sort((a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start));
    return Response.json(
      { events },
      { headers: { ...CORS, "Cache-Control": "public, max-age=900" } }, // 15 min
    );
  }
  return Response.json({ error: "Eventbrite refused every request", errors }, { status: 502, headers: CORS });
  // @ts-nocheck
});
