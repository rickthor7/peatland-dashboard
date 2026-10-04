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
import { getMockTrendData, mockAlerts, mockLatestReadings, mockNodes } from "@/mocks/monitoring";

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
// NODE-002 Ultrasonic, NODE-003 Temperature, NODE-004 Result (risk_index/IKG).
const LIVE_NODES = new Set([REAL_NODE, "NODE-002", "NODE-003", "NODE-004"]);

type SensorLog = { created_at: string; tma: number; moisture: number; ultrasonic: number; risk_index: number };

const PERIOD_HOURS: Record<TimePeriod, number> = { "24h": 24, "7d": 168, "30d": 720 };

// Request identik yang berjalan bersamaan (mis. 4 kartu dashboard tiap poll) berbagi satu fetch.
// Hasilnya dipakai bersama, jadi jangan dimutasi (pakai toReversed, bukan reverse).
const inflight = new Map<string, Promise<SensorLog[]>>();

function fetchLogs(params: Record<string, number>): Promise<SensorLog[]> {
  const url = `/api/readings?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  let req = inflight.get(url);
  if (!req) {
    req = fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`/api/readings ${res.status}`);
        return res.json();
      })
      .finally(() => inflight.delete(url));
    inflight.set(url, req);
  }
  return req;
}

// Data dummy acak dibuat sekali per node+periode agar grafik tidak berubah tiap poll.
const mockTrends = new Map<string, TrendDataPoint[]>();

const toStatus = (v: number): RiskStatus =>
  v >= RISK_THRESHOLDS.AWAS ? "AWAS" : v >= RISK_THRESHOLDS.SIAGA ? "SIAGA" : "AMAN";

const toReading = (log: SensorLog, prev: SensorLog | undefined, nodeId: string): MonitoringReading => ({
  id: `${nodeId}-${log.created_at}`,
  nodeId,
  recordedAt: log.created_at,
  waterLevel: { value: log.ultrasonic, unit: "cm" },
  soilMoisture: { value: log.moisture, unit: "%" },
  temperature: { value: log.tma, unit: "°C" },
  ultrasonic: { value: log.ultrasonic, unit: "cm" },
  riskIndex: {
    value: log.risk_index,
    status: toStatus(log.risk_index),
    calculatedAt: log.created_at,
    previousValue: prev?.risk_index,
  },
});

const highestRisk = (readings: MonitoringReading[]) =>
  readings.reduce<MonitoringReading | null>((w, r) => (!w || r.riskIndex.value > w.riskIndex.value ? r : w), null);

// Semua node + pembacaan terakhirnya; LIVE_NODES diganti data Supabase.
async function snapshot() {
  const [latest, prev] = await fetchLogs({ limit: 2 });
  return {
    nodes: mockNodes.map((n): MonitoringNode =>
      !LIVE_NODES.has(n.id)
        ? n
        : {
            ...n,
            lastSeenAt: latest?.created_at,
            connectionStatus: latest && !isDataStale(latest.created_at) ? "ONLINE" : "OFFLINE",
          }
    ),
    readings: mockNodes.flatMap((n) =>
      !LIVE_NODES.has(n.id)
        ? mockLatestReadings.filter((r) => r.nodeId === n.id)
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
            : `Indeks kerawanan ${log.risk_index}.`) + ` TMA ${log.tma} cm, kelembaban tanah ${log.moisture}%.`,
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
    return {
      overallStatus: highestRisk(readings)?.riskIndex.status ?? "AMAN",
      totalNodes: nodes.length,
      onlineNodes: nodes.filter((n) => n.connectionStatus === "ONLINE").length,
      lastUpdatedAt: readings.map((r) => r.recordedAt).sort().at(-1) ?? new Date().toISOString(),
      isConnected: true,
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
    if (!LIVE_NODES.has(nodeId)) {
      const key = `${nodeId}-${period}`;
      if (!mockTrends.has(key)) mockTrends.set(key, getMockTrendData(nodeId, period));
      return mockTrends.get(key)!;
    }
    return (await fetchLogs({ hours: PERIOD_HOURS[period] })).toReversed().map((l) => ({
      timestamp: l.created_at,
      waterLevel: l.ultrasonic,
      soilMoisture: l.moisture,
      temperature: l.tma,
      ultrasonic: l.ultrasonic,
      riskIndex: l.risk_index,
    }));
  }

  // Global trend mengikuti node nyata, seperti sebelumnya mengikuti NODE-001
  async getGlobalTrendData(period: TimePeriod): Promise<TrendDataPoint[]> {
    return this.getTrendData(REAL_NODE, period);
  }

  // ponytail: alert REAL_NODE dihitung ulang dari 30 hari pembacaan tiap request, "acknowledged" tidak disimpan; buat tabel alerts bila perlu riwayat/ack.
  async getAlerts(params?: { nodeId?: string; status?: string }): Promise<RiskAlert[]> {
    const real = statusChanges((await fetchLogs({ hours: PERIOD_HOURS["30d"] })).toReversed());
    let alerts = [...real, ...mockAlerts.filter((a) => a.nodeId !== REAL_NODE)];
    if (params?.nodeId) alerts = alerts.filter((a) => a.nodeId === params.nodeId);
    if (params?.status && params.status !== "ALL") alerts = alerts.filter((a) => a.status === params.status);
    return alerts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

export const monitoringRepository: MonitoringRepository = new MonitoringService();
