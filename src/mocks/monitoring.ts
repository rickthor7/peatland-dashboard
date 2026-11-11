// Mock data — digunakan selama backend belum tersedia
// Ganti dengan SupabaseMonitoringRepository saat integrasi

import type {
  MonitoringNode,
  MonitoringReading,
  RiskAlert,
  SystemStatus,
  TrendDataPoint,
} from "@/types/domain";
import { computeRisk } from "@/lib/risk";

// ─── Nodes ───────────────────────────────────────────────────────────────────
// Lokasi dummy: lahan gambut Sebangau, Palangka Raya, Kalimantan Tengah.
// Node saling berdekatan (±300–500 m) dalam satu blok pemantauan.

export const mockNodes: MonitoringNode[] = [
  {
    id: "NODE-001",
    name: "Kelembaban Tanah",
    blockName: "Sebangau, Kalteng - Blok A1",
    sensorType: "moisture",
    location: { latitude: -2.3182, longitude: 113.9018 },
    lastSeenAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    connectionStatus: "ONLINE",
  },
  {
    id: "NODE-002",
    name: "TMA",
    blockName: "Sebangau, Kalteng - Blok A2",
    sensorType: "tma",
    location: { latitude: -2.3149, longitude: 113.9052 },
    lastSeenAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    connectionStatus: "ONLINE",
  },
  {
    id: "NODE-003",
    name: "Suhu",
    blockName: "Sebangau, Kalteng - Blok B1",
    sensorType: "temperature",
    location: { latitude: -2.3211, longitude: 113.9067 },
    lastSeenAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    connectionStatus: "ONLINE",
  },
  {
    // Live: data diambil dari Supabase (sensor_logs) oleh monitoringService
    id: "NODE-004",
    name: "Hasil IKG",
    blockName: "Sebangau, Kalteng - Gateway",
    sensorType: "risk",
    location: { latitude: -2.3176, longitude: 113.9043 },
    connectionStatus: "UNKNOWN",
  },
];

// ─── Latest Readings ──────────────────────────────────────────────────────────

export const mockLatestReadings: MonitoringReading[] = [
  {
    id: "READ-001-LATEST",
    nodeId: "NODE-001",
    recordedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    waterLevel: { value: -31, unit: "cm" },
    soilMoisture: { value: 68, unit: "%" },
    temperature: { value: 32.5, unit: "°C" },
    tma: { value: -31, unit: "cm" },
    riskIndex: { value: 42, status: "SIAGA", calculatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), previousValue: 35 },
  },
  {
    id: "READ-002-LATEST",
    nodeId: "NODE-002",
    recordedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    waterLevel: { value: -18, unit: "cm" },
    soilMoisture: { value: 81, unit: "%" },
    temperature: { value: 29.1, unit: "°C" },
    tma: { value: -18, unit: "cm" },
    riskIndex: { value: 22, status: "AMAN", calculatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), previousValue: 24 },
  },
  {
    id: "READ-003-LATEST",
    nodeId: "NODE-003",
    recordedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    waterLevel: { value: -46, unit: "cm" },
    soilMoisture: { value: 41, unit: "%" },
    temperature: { value: 38.4, unit: "°C" },
    tma: { value: -46, unit: "cm" },
    riskIndex: { value: 74, status: "AWAS", calculatedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(), previousValue: 68 },
  },
];

// ─── System Status ────────────────────────────────────────────────────────────

export const mockSystemStatus: SystemStatus = {
  overallStatus: "SIAGA",
  totalNodes: 4,
  onlineNodes: 3,
  lastUpdatedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
  isConnected: true,
  dataMode: "live",
};

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const mockAlerts: RiskAlert[] = [
  {
    id: "ALERT-001",
    nodeId: "NODE-003",
    nodeName: "Suhu",
    blockName: "Blok B",
    status: "AWAS",
    title: "Status Kerawanan AWAS",
    message: "Indeks kerawanan gambut meningkat signifikan. TMA turun ke -46 cm dengan kelembaban tanah 41%.",
    createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: "ALERT-002",
    nodeId: "NODE-001",
    nodeName: "Kelembaban Tanah",
    blockName: "Blok A",
    status: "SIAGA",
    title: "Perubahan Status ke Siaga",
    message: "Indeks kerawanan meningkat dari 35 menjadi 42. Pemantauan lebih lanjut diperlukan.",
    createdAt: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: "ALERT-003",
    nodeId: "NODE-002",
    nodeName: "TMA",
    blockName: "Blok A",
    status: "SIAGA",
    title: "Perubahan Status ke Siaga",
    message: "TMA mencapai -35 cm. Kelembaban tanah menurun ke 61%.",
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    acknowledged: true,
  },
  {
    id: "ALERT-004",
    nodeId: "NODE-003",
    nodeName: "Suhu",
    blockName: "Blok B",
    status: "SIAGA",
    title: "Perubahan Status ke Siaga",
    message: "Kondisi hidrologi mulai memburuk. TMA turun ke -38 cm.",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    acknowledged: true,
  },
];

// ─── Trend Data Generator ─────────────────────────────────────────────────────

function generateTrendData(nodeId: string, hours: number): TrendDataPoint[] {
  const points: TrendDataPoint[] = [];
  const now = Date.now();
  const interval = (hours * 60 * 60 * 1000) / 48; // 48 data points

  // Seed values per node
  const seeds: Record<string, { wl: number; sm: number; tp: number; ri: number }> = {
    "NODE-001": { wl: -28, sm: 72, tp: 31, ri: 35 },
    "NODE-002": { wl: -16, sm: 83, tp: 29, ri: 20 },
    "NODE-003": { wl: -38, sm: 48, tp: 37, ri: 58 },
  };

  const seed = seeds[nodeId] ?? { wl: -25, sm: 70, tp: 32, ri: 30 };
  let wl = seed.wl;
  let sm = seed.sm;
  let tp = seed.tp;
  let ri = seed.ri;

  for (let i = 48; i >= 0; i--) {
    wl = Math.max(-60, Math.min(-5, wl + (Math.random() - 0.48) * 2.5));
    sm = Math.max(20, Math.min(95, sm + (Math.random() - 0.45) * 3));
    tp = Math.max(25, Math.min(45, tp + (Math.random() - 0.5) * 0.8));
    ri = Math.max(0, Math.min(100, ri + (Math.random() - 0.45) * 4));
    points.push({
      timestamp: new Date(now - i * interval).toISOString(),
      waterLevel: Math.round(wl * 10) / 10,
      soilMoisture: Math.round(sm * 10) / 10,
      temperature: Math.round(tp * 10) / 10,
      tma: Math.round(wl * 10) / 10,
      riskIndex: Math.round(ri),
    });
  }
  return points;
}

export function getMockTrendData(nodeId: string, period: "24h" | "7d" | "30d"): TrendDataPoint[] {
  const hours = period === "24h" ? 24 : period === "7d" ? 168 : 720;
  return generateTrendData(nodeId, hours);
}

// Global trend (agregasi semua node)
export function getMockGlobalTrendData(period: "24h" | "7d" | "30d"): TrendDataPoint[] {
  return getMockTrendData("NODE-001", period);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE DUMMY — data dibuat langsung di browser (tanpa MQTT, tanpa database)
// Dipakai otomatis saat koneksi database terputus. Semua nilai dijaga pada
// rentang aman sehingga status yang ditampilkan tetap AMAN (tidak memicu
// peringatan palsu dari data rekaan).
// ═══════════════════════════════════════════════════════════════════════════

/** Baseline aman: lahan gambut basah, tanah lembap, suhu sedang. */
export const DUMMY_BASELINE = {
  tma: -22,
  moisture: 70,
  temperature: 30,
} as const;

/** Osilasi halus berbasis waktu — data tetap hidup tiap poll. */
function wave(hours: number, periodHours: number, amp: number, phase = 0): number {
  return Math.sin((hours / periodHours) * Math.PI * 2 + phase) * amp;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Nilai sensor dummy saat ini (aman). */
export function getDummySensorValues(now = Date.now()) {
  const h = now / 3_600_000;
  const tma = DUMMY_BASELINE.tma + wave(h, 6, 5) + wave(h, 17, 1.5);
  const moisture = DUMMY_BASELINE.moisture + wave(h, 9, 6) + wave(h, 23, 2);
  const temperature = DUMMY_BASELINE.temperature + wave(h, 7, 3) + wave(h, 19, 1);
  return {
    tma: round1(Math.max(-30, Math.min(-16, tma))),
    moisture: round1(Math.max(62, Math.min(78, moisture))),
    temperature: round1(Math.max(27, Math.min(34, temperature))),
  };
}

/** Deret tren dummy yang konsisten dengan nilai saat ini. */
export function getDummyTrendData(period: "24h" | "7d" | "30d"): TrendDataPoint[] {
  const hours = period === "24h" ? 24 : period === "7d" ? 168 : 720;
  const points = 48;
  const step = (hours * 3_600_000) / points;
  const now = Date.now();
  const out: TrendDataPoint[] = [];

  for (let i = points; i >= 0; i--) {
    const t = now - i * step;
    const h = t / 3_600_000;
    const tma = DUMMY_BASELINE.tma + wave(h, 6, 5) + wave(h, 17, 1.5);
    const moisture = DUMMY_BASELINE.moisture + wave(h, 9, 6) + wave(h, 23, 2);
    const temperature = DUMMY_BASELINE.temperature + wave(h, 7, 3) + wave(h, 19, 1);
    const risk = computeRisk(tma, moisture, temperature);

    out.push({
      timestamp: new Date(t).toISOString(),
      waterLevel: round1(tma),
      soilMoisture: round1(moisture),
      temperature: round1(temperature),
      tma: round1(tma),
      riskIndex: risk.index,
    });
  }
  return out;
}

