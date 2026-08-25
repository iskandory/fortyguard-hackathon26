import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FORTYGUARD_BASE_URL = "https://api.fortyguard.com";
const FORTYGUARD_API_KEY = Deno.env.get("FORTYGUARD_API_KEY");
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 60000;

if (!FORTYGUARD_API_KEY) {
  console.error("refresh-facility: FORTYGUARD_API_KEY is not set — every request will fail");
}

// Only the deployed dashboard (and local dev) should ever call this function
// directly; everything else reads pre-computed data out of Supabase. This
// isn't a strong access control on its own (the request still executes
// server-side regardless of the Origin header — CORS only gates whether a
// browser lets its own JS read the response) but it stops a random third
// party's browser-based script from riding the dashboard's own CORS policy.
const ALLOWED_ORIGINS = new Set([
  "https://fortyguard-thermal-console.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

// Best-effort, per-isolate fixed-window rate limit. Supabase Edge Functions
// can scale across multiple isolates, so this doesn't guarantee a hard global
// cap, but it stops a single client from looping requests against this
// instance and burning FortyGuard credits, which is the actual risk here —
// there's no per-key spend limit upstream.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const requestLog = new Map<string, number[]>();

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(clientId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    requestLog.set(clientId, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(clientId, timestamps);
  return false;
}

// FortyGuard's documented coverage is US-only; anything outside a generous
// CONUS-plus-margin bounding box can't return real data and isn't worth a
// credit-spending upstream call. air_temp_c just needs to be a plausible
// physical reading, not exact — it's a seed value for the API call, not a
// stored measurement.
function validatePayload(body: unknown): { lat: number; lon: number; air_temp_c: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const { lat, lon, air_temp_c } = body as Record<string, unknown>;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < 15 || lat > 72) return null;
  if (typeof lon !== "number" || !Number.isFinite(lon) || lon < -170 || lon > -65) return null;
  if (typeof air_temp_c !== "number" || !Number.isFinite(air_temp_c) || air_temp_c < -50 || air_temp_c > 60) {
    return null;
  }
  return { lat, lon, air_temp_c };
}

async function pollActivity(activityId: string): Promise<unknown> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${FORTYGUARD_BASE_URL}/v1/status/${activityId}`, {
      headers: { "api-key": FORTYGUARD_API_KEY! },
    });
    const body = await res.json();
    const status = body?.data?.status;
    if (status === "Completed") return body.data.result;
    if (status === "Failed") throw new Error(`activity ${activityId} failed`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`activity ${activityId} timed out`);
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  if (!FORTYGUARD_API_KEY) {
    return new Response(JSON.stringify({ error: "service misconfigured" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const clientId = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(clientId)) {
    return new Response(JSON.stringify({ error: "rate limit exceeded" }), {
      status: 429,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  let payload: { lat: number; lon: number; air_temp_c: number } | null;
  try {
    payload = validatePayload(await req.json());
  } catch {
    payload = null;
  }
  if (!payload) {
    return new Response(JSON.stringify({ error: "invalid request body" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  const { lat, lon, air_temp_c } = payload;
  const now = new Date();

  try {
    const submitRes = await fetch(`${FORTYGUARD_BASE_URL}/v1/env_params`, {
      method: "POST",
      headers: { "api-key": FORTYGUARD_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        temperature: air_temp_c,
        date_time: {
          start_date: now.toISOString().slice(0, 10),
          filter_type: 1,
          start_time: now.toISOString().slice(11, 16),
        },
        analysis: ["wet_bulb_temperature_celsius", "heat_index_celsius"],
      }),
    });
    const submitBody = await submitRes.json();
    const activityId = submitBody?.data?.activity_id;
    if (!activityId) {
      // Log the upstream body server-side for debugging, but don't hand a
      // raw FortyGuard response — which could include account/billing
      // details — back to whoever called this function.
      console.error("refresh-facility: submission failed", submitBody);
      return new Response(JSON.stringify({ error: "upstream submission failed" }), {
        status: 502,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const result = await pollActivity(activityId);
    return new Response(JSON.stringify(result), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("refresh-facility: unhandled error", err);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
