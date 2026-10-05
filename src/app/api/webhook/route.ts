import { createClient } from "@supabase/supabase-js";

// Preflight CORS handler for external webhook calls
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, x-webhook-secret, Authorization",
    },
  });
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// EMQX Cloud HTTP action → sensor_logs. Payload: { tma, moisture, temperature }.
// tma = ground water level (cm, negatif di bawah permukaan).
export async function POST(request: Request) {
  // Set the same value as a custom header in the EMQX HTTP action.
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const text = await request.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    console.warn("webhook rejected, invalid JSON:", text);
    return Response.json(
      { success: false, error: "Invalid JSON body", received: text },
      { status: 400 },
    );
  }

  // Dukung payload langsung maupun jika dibungkus { payload: { ... } } atau { data: { ... } }
  const data =
    (body?.payload && typeof body.payload === "object" ? body.payload : null) ||
    (body?.data && typeof body.data === "object" ? body.data : null) ||
    (body ?? {});

  const tma = Number(data?.tma);
  const moisture = Number(data?.moisture);
  const temperature = Number(data?.temperature ?? data?.temp ?? data?.suhu);

  if (![tma, moisture, temperature].every(Number.isFinite)) {
    console.warn("webhook rejected, bad fields:", text);
    return Response.json(
      {
        success: false,
        error: "tma, moisture and temperature must be valid numbers",
        received: body,
      },
      { status: 400 },
    );
  }

  // HVI paper: normalisasi tiap sensor ke 0-1 dulu, clamp, kali bobot, lalu x100.
  // D_SM makin besar bila tanah makin kering, D_T bila suhu makin tinggi,
  // D_TMA bila muka air makin dalam. D = max(0, -tma), genangan → D_TMA = 0.
  const distance = Math.max(0, -tma);
  const dSM = clamp01((80 - moisture) / 80);
  const dT = clamp01((temperature - 20) / (40 - 20));
  const dTMA = clamp01(distance / 150);

  // HVI = 100 x (0.3*D_SM + 0.2*D_T + 0.5*D_TMA).
  const risk_index = Math.round(100 * (0.3 * dSM + 0.2 * dT + 0.5 * dTMA));
  const S = Math.round(dSM * 100);
  const T = Math.round(dT * 100);
  const W = Math.round(dTMA * 100);

  try {
    // Created per request so a missing env var surfaces as a 500 instead of breaking the build.
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
    const { error } = await supabase.from("sensor_logs").insert({
      tma,
      moisture,
      temperature,
      risk_index,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;

    console.log("webhook saved:", {
      tma,
      moisture,
      temperature,
      distance,
      S,
      T,
      W,
      risk_index,
    });
    return Response.json({ success: true, risk_index, S, T, W });
  } catch (err) {
    console.error("sensor_logs insert failed:", err);
    return Response.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
