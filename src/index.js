import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const FEED_URL =
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw";

const ROUTE_ID = "R";

// Whitehall St–South Ferry stop is R27 in GTFS. Realtime stop IDs are typically R27S / R27N.
// We’ll check both and take the soonest upcoming arrival.
const STOP_IDS_TO_CHECK = ["R27S"];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/next-r") {
      return new Response("Not found", { status: 404, headers: corsHeaders() });
    }

    try {
      const headers = new Headers();
      // Optional secret if you add it in Cloudflare later:
      if (env.MTA_API_KEY) headers.set("x-api-key", env.MTA_API_KEY);

      const res = await fetch(FEED_URL, { headers, cf: { cacheTtl: 0 } });
      if (!res.ok) {
        return new Response(
          JSON.stringify({ ok: false, error: `MTA feed error: ${res.status}` }),
          { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      const arrBuf = await res.arrayBuffer();
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(arrBuf)
);

    const now = Math.floor(Date.now() / 1000);
const upcoming = [];

for (const entity of feed.entity) {
  const tu = entity.tripUpdate;
  if (!tu?.trip) continue;
  if (tu.trip.routeId !== ROUTE_ID) continue;

  for (const u of tu.stopTimeUpdate || []) {
    if (!u.stopId) continue;
    if (!STOP_IDS_TO_CHECK.includes(u.stopId)) continue;

    const t = (u.arrival && u.arrival.time) || (u.departure && u.departure.time);
    if (!t) continue;
    if (t <= now) continue;

    upcoming.push(t);
  }
}

// sort ascending and keep the next 2 unique times
upcoming.sort((a, b) => a - b);
const nextTwo = [];
for (const t of upcoming) {
  if (nextTwo.length === 0 || t !== nextTwo[nextTwo.length - 1]) {
    nextTwo.push(t);
  }
  if (nextTwo.length === 2) break;
}

      return new Response(
        JSON.stringify({
          ok: true,
          route: "R",
          station: "Whitehall St–South Ferry",
          direction: "Brooklyn-bound (needs confirmation)",
          matchedStopId: bestStopId,
          nextArrivalEpoch: bestEpoch,
          fetchedAtEpoch: Math.floor(Date.now() / 1000),
        }),
        { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, error: e.message }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }
  },
};
