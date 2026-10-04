import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

// Read side for the client components; keeps the Supabase key on the server.
// GET /api/readings?hours=24&limit=2 → sensor_logs rows, newest first.
// ponytail: capped at Supabase's default 1000 rows, so long periods keep only the newest 1000; downsample in SQL when history outgrows it.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const hours = Number(params.get("hours"));
  const limit = Math.min(Number(params.get("limit")) || 1000, 1000);

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  let query = supabase
    .from("sensor_logs")
    .select("created_at, tma, moisture, ultrasonic, risk_index")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (hours > 0) query = query.gte("created_at", new Date(Date.now() - hours * 3_600_000).toISOString());

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
