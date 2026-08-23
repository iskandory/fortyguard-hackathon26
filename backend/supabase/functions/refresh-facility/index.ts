import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FORTYGUARD_BASE_URL = "https://api.fortyguard.com";
const FORTYGUARD_API_KEY = Deno.env.get("FORTYGUARD_API_KEY")!;
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 60000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function pollActivity(activityId: string): Promise<unknown> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${FORTYGUARD_BASE_URL}/v1/status/${activityId}`, {
      headers: { "api-key": FORTYGUARD_API_KEY },
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let lat: number, lon: number, air_temp_c: number;
  try {
    ({ lat, lon, air_temp_c } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const now = new Date();

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
    return new Response(JSON.stringify({ error: "submission failed", body: submitBody }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await pollActivity(activityId);
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
