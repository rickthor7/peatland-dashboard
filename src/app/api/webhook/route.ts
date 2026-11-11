import { createClient } from "@supabase/supabase-js";
import { computeRisk } from "@/lib/risk";

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
  // Rumus tunggal di src/lib/risk.ts (dipakai juga mode dummy di client).
  const distance = Math.max(0, -tma);
  const { index: risk_index, dSM: S, dT: T, dTMA: W } = computeRisk(
    tma,
    moisture,
    temperature,
  );

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
