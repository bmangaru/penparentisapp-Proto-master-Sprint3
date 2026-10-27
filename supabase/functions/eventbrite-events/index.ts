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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const token = Deno.env.get("EVENTBRITE_TOKEN");
  if (!token) return Response.json({ error: "EVENTBRITE_TOKEN not set" }, { status: 500, headers: CORS });

  const url = `${API}?status=live&order_by=start_asc&expand=venue&page_size=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    return Response.json({ error: `Eventbrite ${res.status}` }, { status: 502, headers: CORS });
  }
  const body = await res.json();
  const events = (body.events ?? []).map(trim).filter((e: { start?: string }) => e.start);

  return Response.json(
    { events },
    { headers: { ...CORS, "Cache-Control": "public, max-age=900" } }, // 15 min
  );
});
