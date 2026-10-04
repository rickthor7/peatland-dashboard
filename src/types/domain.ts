// Domain types — Integrated IoT-Web Analytics System
// Kontrak frontend; tidak terikat pada schema Supabase

export type RiskStatus = "AMAN" | "SIAGA" | "AWAS";

export type ConnectionStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

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

export type SensorType = "moisture" | "ultrasonic" | "temperature" | "risk";

export interface MonitoringReading {
  id: string;
  nodeId: string;
  recordedAt: string;
  waterLevel: WaterLevel;
  soilMoisture: SoilMoisture;
  temperature: WaterLevel;
  ultrasonic: WaterLevel;
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
}

export interface TrendDataPoint {
  timestamp: string;
  waterLevel: number;
  soilMoisture: number;
  temperature: number;
  ultrasonic: number;
  riskIndex: number;
}

export type TimePeriod = "24h" | "7d" | "30d";
