import { createClient } from "@supabase/supabase-js";

// Preflight CORS handler for external webhook calls
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret, Authorization",
    },
  });
}

const clamp100 = (v: number) => Math.min(100, Math.max(0, v));

// EMQX Cloud HTTP action → sensor_logs. Payload: { tma, moisture, ultrasonic } (+ alias temperature).
// tma = suhu MAX6675 (°C), moisture M (%), ultrasonic D (cm). risk_index dihitung server-side.
export async function POST(request: Request) {
  // Set the same value as a custom header in the EMQX HTTP action.
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const text = await request.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    console.warn("webhook rejected, invalid JSON:", text);
    return Response.json({ success: false, error: "Invalid JSON body", received: text }, { status: 400 });
  }

  // Dukung payload langsung maupun jika dibungkus { payload: { ... } } atau { data: { ... } }
  const data =
    (body?.payload && typeof body.payload === "object" ? body.payload : null) ||
    (body?.data && typeof body.data === "object" ? body.data : null) ||
    (body ?? {});

  const moisture = Number(data?.moisture);
  const tActual = Number(data?.temperature ?? data?.tma);
  const distance = Number(data?.ultrasonic ?? data?.distance ?? data?.d);

  if (![moisture, tActual, distance].every(Number.isFinite)) {
    console.warn("webhook rejected, bad fields:", text);
    return Response.json(
      { success: false, error: "moisture, temperature/tma and ultrasonic must be valid numbers", received: body },
      { status: 400 }
    );
  }

  const S = clamp100(((60 - moisture) / (60 - 20)) * 100);
  const T = clamp100(((tActual - 25) / (45 - 25)) * 100);
  const W = clamp100(((distance - 10) / (100 - 10)) * 100);

  // weight constant
  const risk_index = Math.round(0.4 * S + 0.3 * T + 0.3 * W);

  try {
    // Created per request so a missing env var surfaces as a 500 instead of breaking the build.
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const { error } = await supabase.from("sensor_logs").insert({
      tma: tActual,
      moisture,
      ultrasonic: distance,
      risk_index,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;

    console.log("webhook saved:", { moisture, tActual, distance, S, T, W, risk_index });
    return Response.json({ success: true, risk_index, S, T, W });
  } catch (err) {
    console.error("sensor_logs insert failed:", err);
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
