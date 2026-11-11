// Monitoring Service — abstraction layer antara UI dan data source
// Ganti implementasinya tanpa mengubah UI

import type {
  MonitoringNode,
  MonitoringReading,
  RiskAlert,
  RiskStatus,
  SystemStatus,
  TimePeriod,
  TrendDataPoint,
} from "@/types/domain";
import { RISK_THRESHOLDS, isDataStale } from "@/lib/constants";
import { computeRisk, toRiskStatus } from "@/lib/risk";
import {
  getDummySensorValues,
  getDummyTrendData,
  getMockTrendData,
  mockAlerts,
  mockLatestReadings,
  mockNodes,
} from "@/mocks/monitoring";

export interface MonitoringRepository {
  getSystemStatus(): Promise<SystemStatus>;
  getLatestReading(nodeId?: string): Promise<MonitoringReading | null>;
  getLatestReadings(): Promise<MonitoringReading[]>;
  getNodes(): Promise<MonitoringNode[]>;
  getNode(nodeId: string): Promise<MonitoringNode | null>;
  getTrendData(nodeId: string, period: TimePeriod): Promise<TrendDataPoint[]>;
  getGlobalTrendData(period: TimePeriod): Promise<TrendDataPoint[]>;
  getAlerts(params?: { nodeId?: string; status?: string }): Promise<RiskAlert[]>;
}

// ─── Supabase + Mock Implementation ───────────────────────────────────────────
// REAL_NODE: ESP32 → EMQX → /api/webhook → sensor_logs → /api/readings → di sini
// Satu ESP32 mengirim semua sensor, jadi semua node membaca baris sensor_logs
// yang sama dan masing-masing hanya menampilkan sensornya sendiri.

// ponytail: semua node live membaca baris sensor_logs yang sama; tambah kolom node_id di sensor_logs saat ESP32 berikutnya terpasang.
const REAL_NODE = "NODE-001";
// NODE-002 TMA, NODE-003 Suhu, NODE-004 Hasil IKG (risk_index/IKG).
const LIVE_NODES = new Set([REAL_NODE, "NODE-002", "NODE-003", "NODE-004"]);

type SensorLog = { created_at: string; tma: number; moisture: number; temperature: number; risk_index: number };

const PERIOD_HOURS: Record<TimePeriod, number> = { "24h": 24, "7d": 168, "30d": 720 };

// Request identik yang berjalan bersamaan (mis. 4 kartu dashboard tiap poll) berbagi satu fetch.
// Hasilnya dipakai bersama, jadi jangan dimutasi (pakai toReversed, bukan reverse).
const inflight = new Map<string, Promise<SensorLog[] | null>>();

// Status mode data global (diperbarui setiap request ke /api/readings).
let dataMode: "live" | "dummy" = "live";
let modeNote = "";

/** Mode data aktif: "live" (telemetri asli) atau "dummy" (cadangan, dibuat di browser). */
export function getDataMode(): { mode: "live" | "dummy"; note: string } {
  return { mode: dataMode, note: modeNote };
}

function enterDummyMode(reason: string) {
  if (dataMode !== "dummy") {
    console.warn(`[monitoring] koneksi database terputus → mode dummy aktif. Alasan: ${reason}`);
  }
  dataMode = "dummy";
  modeNote = reason;
}

function enterLiveMode() {
  if (dataMode !== "live") {
    console.info("[monitoring] koneksi database pulih → mode live aktif kembali.");
  }
  dataMode = "live";
  modeNote = "";
}

// Timeout supaya koneksi yang menggantung tidak menggantungi UI.
const READ_TIMEOUT_MS = 8_000;

function fetchLogs(params: Record<string, number>): Promise<SensorLog[] | null> {
  const url = `/api/readings?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  let req = inflight.get(url);
  if (!req) {
    req = fetch(url, { cache: "no-store", signal: AbortSignal.timeout(READ_TIMEOUT_MS) })
      .then((res) => {
        // 503 not_configured = env Supabase belum diisi (mis. dev lokal)
        if (res.status === 503) {
          enterDummyMode("backend belum dikonfigurasi (env Supabase kosong)");
          return null;
        }
        // 5xx / 4xx lain = koneksi ke database gagal → mode dummy.
        if (!res.ok) {
          enterDummyMode(`database merespons HTTP ${res.status}`);
          return null;
        }
        enterLiveMode();
        return res.json();
      })
      .catch((err: unknown) => {
        const reason =
          err instanceof DOMException && err.name === "TimeoutError"
            ? "database tidak merespons (timeout)"
            : `koneksi gagal: ${err instanceof Error ? err.message : "unknown error"}`;
        enterDummyMode(reason);
        return null;
      })
      .finally(() => inflight.delete(url));
    inflight.set(url, req);
  }
  return req;
}

// Data dummy acak dibuat sekali per node+periode agar grafik tidak berubah tiap poll.
const mockTrends = new Map<string, TrendDataPoint[]>();

const toStatus = (v: number): RiskStatus => toRiskStatus(v);

/**
 * Pembacaan dummy: dibuat langsung di browser (tanpa MQTT, tanpa database).
 * Nilai dijaga pada rentang aman sehingga IKG → AMAN dan tidak ada
 * peringatan palsu dari data rekaan.
 */
function dummyReading(nodeId: string, base: MonitoringReading): MonitoringReading {
  const now = new Date().toISOString();
  const { tma, moisture, temperature } = getDummySensorValues();
  const risk = computeRisk(tma, moisture, temperature);
  const index = Math.min(risk.index, RISK_THRESHOLDS.SIAGA - 1); // jaga status AMAN

  return {
    ...base,
    id: `${nodeId}-${now}`,
    nodeId,
    recordedAt: now,
    waterLevel: { value: tma, unit: "cm" },
    soilMoisture: { value: moisture, unit: "%" },
    temperature: { value: temperature, unit: "°C" },
    tma: { value: tma, unit: "cm" },
    riskIndex: {
      value: index,
      status: "AMAN",
      calculatedAt: now,
      previousValue: base.riskIndex.value,
    },
  };
}

/** Pembacaan dummy untuk seluruh node (fallback per-node dari mock). */
function dummyReadings(): MonitoringReading[] {
  // NODE-004 (Hasil IKG) tidak punya entri mock → pakai basis node pertama.
  const fallback = mockLatestReadings[0];
  return mockNodes.flatMap((n) => {
    const base = mockLatestReadings.find((r) => r.nodeId === n.id) ?? fallback;
    if (!base) return [];
    return [dummyReading(n.id, base)];
  });
}

const toReading = (log: SensorLog, prev: SensorLog | undefined, nodeId: string): MonitoringReading => ({
  id: `${nodeId}-${log.created_at}`,
  nodeId,
  recordedAt: log.created_at,
  waterLevel: { value: log.tma, unit: "cm" },
  soilMoisture: { value: log.moisture, unit: "%" },
  temperature: { value: log.temperature, unit: "°C" },
  tma: { value: log.tma, unit: "cm" },
  riskIndex: {
    value: log.risk_index,
    status: toStatus(log.risk_index),
    calculatedAt: log.created_at,
    previousValue: prev?.risk_index,
  },
});

const highestRisk = (readings: MonitoringReading[]) =>
  readings.reduce<MonitoringReading | null>((w, r) => (!w || r.riskIndex.value > w.riskIndex.value ? r : w), null);

// Dummy node: simulasi telemetri yang "dikirim" tiap poll (nilai berfluktuasi di sekitar baseline mock,
// timestamp = sekarang) agar peta/popup terasa realtime. Node live tetap dari Supabase.
const round1 = (v: number) => Math.round(v * 10) / 10;
const wobble = (v: number, amp: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v + (Math.random() - 0.5) * amp));

function simulateReading(base: MonitoringReading): MonitoringReading {
  const now = new Date().toISOString();
  const ri = Math.round(wobble(base.riskIndex.value, 4, 0, 100));
  return {
    ...base,
    id: `${base.nodeId}-${now}`,
    recordedAt: now,
    waterLevel: { ...base.waterLevel, value: round1(wobble(base.waterLevel.value, 2, -80, 0)) },
    soilMoisture: { ...base.soilMoisture, value: round1(wobble(base.soilMoisture.value, 3, 0, 100)) },
    riskIndex: { value: ri, status: toStatus(ri), calculatedAt: now, previousValue: base.riskIndex.value },
  };
}

// Semua node + pembacaan terakhirnya; LIVE_NODES diganti data Supabase.
// fetchLogs null = database tak terhubung → mode dummy: data dibuat di browser.
async function snapshot() {
  const logs = await fetchLogs({ limit: 2 });
  const now = new Date().toISOString();
  if (!logs) {
    return {
      nodes: mockNodes.map((n): MonitoringNode => ({
        ...n,
        lastSeenAt: now,
        // Koneksi nyata tidak diketahui saat DB terputus → UNKNOWN (bukan ONLINE).
        connectionStatus: "UNKNOWN",
      })),
      readings: dummyReadings(),
    };
  }
  const [latest, prev] = logs;
  return {
    nodes: mockNodes.map((n): MonitoringNode =>
      !LIVE_NODES.has(n.id)
        ? { ...n, lastSeenAt: n.connectionStatus === "ONLINE" ? now : n.lastSeenAt }
        : {
            ...n,
            lastSeenAt: latest?.created_at,
            connectionStatus: latest && !isDataStale(latest.created_at) ? "ONLINE" : "OFFLINE",
          }
    ),
    readings: mockNodes.flatMap((n) =>
      !LIVE_NODES.has(n.id)
        ? mockLatestReadings.filter((r) => r.nodeId === n.id).map(simulateReading)
        : latest
          ? [toReading(latest, prev, n.id)]
          : []
    ),
  };
}

// Alert = setiap perubahan status IKG antar pembacaan REAL_NODE (logs urut lama → baru).
function statusChanges(logs: SensorLog[]): RiskAlert[] {
  const node = mockNodes.find((n) => n.id === REAL_NODE);
  const alerts: RiskAlert[] = [];
  let prev: SensorLog | undefined;
  for (const log of logs) {
    const status = toStatus(log.risk_index);
    if (status !== toStatus(prev?.risk_index ?? 0)) {
      alerts.push({
        id: `${REAL_NODE}-${log.created_at}`,
        nodeId: REAL_NODE,
        nodeName: node?.name,
        blockName: node?.blockName,
        status,
        title: `Perubahan Status ke ${status}`,
        message:
          (prev
            ? `Indeks kerawanan berubah dari ${prev.risk_index} menjadi ${log.risk_index}.`
            : `Indeks kerawanan ${log.risk_index}.`) +
          ` TMA ${log.tma} cm, kelembaban tanah ${log.moisture}%, suhu ${log.temperature}°C.`,
        createdAt: log.created_at,
      });
    }
    prev = log;
  }
  return alerts;
}

class MonitoringService implements MonitoringRepository {
  async getSystemStatus(): Promise<SystemStatus> {
    const { nodes, readings } = await snapshot();
    const dummy = dataMode === "dummy";
    return {
      // Mode dummy selalu AMAN: data rekaan tidak boleh memicu status kritis.
      overallStatus: dummy ? "AMAN" : highestRisk(readings)?.riskIndex.status ?? "AMAN",
      totalNodes: nodes.length,
      onlineNodes: dummy ? 0 : nodes.filter((n) => n.connectionStatus === "ONLINE").length,
      lastUpdatedAt: readings.map((r) => r.recordedAt).sort().at(-1) ?? new Date().toISOString(),
      isConnected: !dummy,
      dataMode: dataMode,
      modeNote: modeNote || undefined,
    };
  }

  async getLatestReading(nodeId?: string): Promise<MonitoringReading | null> {
    const { readings } = await snapshot();
    if (nodeId) return readings.find((r) => r.nodeId === nodeId) ?? null;
    // Reading dengan risk tertinggi sebagai global overview
    return highestRisk(readings);
  }

  async getLatestReadings(): Promise<MonitoringReading[]> {
    return (await snapshot()).readings;
  }

  async getNodes(): Promise<MonitoringNode[]> {
    return (await snapshot()).nodes;
  }

  async getNode(nodeId: string): Promise<MonitoringNode | null> {
    return (await this.getNodes()).find((n) => n.id === nodeId) ?? null;
  }

  async getTrendData(nodeId: string, period: TimePeriod): Promise<TrendDataPoint[]> {
    const key = `${nodeId}-${period}`;
    const mock = () => {
      if (!mockTrends.has(key)) mockTrends.set(key, getMockTrendData(nodeId, period));
      return mockTrends.get(key)!;
    };
    if (!LIVE_NODES.has(nodeId)) return mock();
    const logs = await fetchLogs({ hours: PERIOD_HOURS[period] });
    // Mode dummy → tren disimulasikan di browser, tetap pada rentang aman.
    if (!logs) return getDummyTrendData(period);
    return logs.toReversed().map((l) => ({
      timestamp: l.created_at,
      waterLevel: l.tma,
      soilMoisture: l.moisture,
      temperature: l.temperature,
      tma: l.tma,
      riskIndex: l.risk_index,
    }));
  }

  // Global trend mengikuti node nyata, seperti sebelumnya mengikuti NODE-001
  async getGlobalTrendData(period: TimePeriod): Promise<TrendDataPoint[]> {
    return this.getTrendData(REAL_NODE, period);
  }

  // ponytail: alert REAL_NODE dihitung ulang dari 30 hari pembacaan tiap request, "acknowledged" tidak disimpan; buat tabel alerts bila perlu riwayat/ack.
  async getAlerts(params?: { nodeId?: string; status?: string }): Promise<RiskAlert[]> {
    const logs = await fetchLogs({ hours: PERIOD_HOURS["30d"] });

    // Mode dummy: tidak ada riwayat telemetri nyata → satu info AMAN saja.
    if (!logs) {
      const info: RiskAlert = {
        id: "MODE-DUMMY",
        nodeId: REAL_NODE,
        nodeName: mockNodes.find((n) => n.id === REAL_NODE)?.name,
        blockName: "Sebangau, Kalteng - Blok A1",
        status: "AMAN",
        title: "Mode Simulasi (Dummy) Aktif",
        message:
          `Koneksi database terputus${modeNote ? ` (${modeNote})` : ""}. ` +
          "Data yang tampil dibuat langsung di website tanpa MQTT dan berstatus AMAN " +
          "hingga koneksi ke database pulih.",
        createdAt: new Date().toISOString(),
        acknowledged: true,
      };
      let dummyAlerts = [info];
      if (params?.nodeId) dummyAlerts = dummyAlerts.filter((a) => a.nodeId === params.nodeId);
      if (params?.status && params.status !== "ALL")
        dummyAlerts = dummyAlerts.filter((a) => a.status === params.status);
      return dummyAlerts;
    }

    const real = statusChanges(logs.toReversed());
    let alerts = [...real, ...mockAlerts.filter((a) => a.nodeId !== REAL_NODE)];
    if (params?.nodeId) alerts = alerts.filter((a) => a.nodeId === params.nodeId);
    if (params?.status && params.status !== "ALL") alerts = alerts.filter((a) => a.status === params.status);
    return alerts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

export const monitoringRepository: MonitoringRepository = new MonitoringService();
