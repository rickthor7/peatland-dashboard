// Domain types — Integrated IoT-Web Analytics System
// Kontrak frontend; tidak terikat pada schema Supabase

export type RiskStatus = "AMAN" | "SIAGA" | "AWAS";

export type ConnectionStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

/**
 * Sumber data yang sedang dipakai:
 * - "live"  : data telemetri asli dari database (sensor_logs)
 * - "dummy" : mode cadangan saat koneksi database terputus — data dibuat
 *             langsung di browser (tanpa MQTT) dan status dipaksa AMAN.
 */
export type DataMode = "live" | "dummy";

export interface RiskIndex {
  value: number;
  status: RiskStatus;
  calculatedAt: string;
  previousValue?: number;
}

export interface WaterLevel {
  value: number;
  unit: string;
}

export interface SoilMoisture {
  value: number;
  unit: string;
}

export type SensorType = "moisture" | "tma" | "temperature" | "risk";

export interface MonitoringReading {
  id: string;
  nodeId: string;
  recordedAt: string;
  waterLevel: WaterLevel;
  soilMoisture: SoilMoisture;
  temperature: WaterLevel;
  tma: WaterLevel;
  riskIndex: RiskIndex;
}

export interface MonitoringNode {
  id: string;
  name: string;
  blockName?: string;
  sensorType?: SensorType;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  lastSeenAt?: string;
  connectionStatus: ConnectionStatus;
}

export interface RiskAlert {
  id: string;
  nodeId: string;
  nodeName?: string;
  blockName?: string;
  status: RiskStatus;
  title: string;
  message: string;
  createdAt: string;
  acknowledged?: boolean;
}

export interface SystemStatus {
  overallStatus: RiskStatus;
  totalNodes: number;
  onlineNodes: number;
  lastUpdatedAt: string;
  isConnected: boolean;
  /** Sumber data aktif: telemetri asli atau dummy. */
  dataMode: DataMode;
  /** Alasan masuk mode dummy (mis. "HTTP 500" / "network error"). */
  modeNote?: string;
}

export interface TrendDataPoint {
  timestamp: string;
  waterLevel: number;
  soilMoisture: number;
  temperature: number;
  tma: number;
  riskIndex: number;
  /** true bila titik dibuat di browser (mode dummy), bukan telemetri asli. */
  synthetic?: boolean;
}

export type TimePeriod = "24h" | "7d" | "30d";
