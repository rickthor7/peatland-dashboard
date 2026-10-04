// Design tokens & utility helpers

/** Batas nilai IKG untuk tiap level status */
export const RISK_THRESHOLDS = {
  /** IKG ≥ 70 → AWAS */
  AWAS: 70,
  /** IKG ≥ 40 → SIAGA */
  SIAGA: 40,
} as const;

export const STATUS_CONFIG = {
  AMAN: {
    label: "AMAN",
    color: "var(--status-aman)",
    colorBg: "var(--status-aman-bg)",
    colorBorder: "var(--status-aman-border)",
    icon: "shield-check",
    description: "Kondisi berada dalam rentang aman",
  },
  SIAGA: {
    label: "SIAGA",
    color: "var(--status-siaga)",
    colorBg: "var(--status-siaga-bg)",
    colorBorder: "var(--status-siaga-border)",
    icon: "alert-triangle",
    description: "Kondisi membutuhkan perhatian dan pemantauan",
  },
  AWAS: {
    label: "AWAS",
    color: "var(--status-awas)",
    colorBg: "var(--status-awas-bg)",
    colorBorder: "var(--status-awas-border)",
    icon: "alert-octagon",
    description: "Kondisi memiliki kerentanan tinggi dan membutuhkan tindakan",
  },
} as const;

export const CONNECTION_CONFIG = {
  ONLINE: { label: "Online", color: "var(--status-aman)" },
  OFFLINE: { label: "Offline", color: "var(--status-awas)" },
  UNKNOWN: { label: "Tidak Diketahui", color: "var(--text-tertiary)" },
} as const;

export const SENSOR_META = {
  moisture: { label: "Kelembaban Tanah", short: "Kelembaban", unit: "%" },
  ultrasonic: { label: "Jarak Ultrasonik", short: "Ultrasonik", unit: "cm" },
  temperature: { label: "Suhu", short: "Suhu", unit: "°C" },
  risk: { label: "Indeks Kerawanan", short: "Indeks", unit: "/100" },
} as const;

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari lalu`;
}

export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatChartTime(iso: string, period: "24h" | "7d" | "30d"): string {
  const date = new Date(iso);
  if (period === "24h") {
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export function isDataStale(iso: string, thresholdMinutes = 15): boolean {
  const diffMs = Date.now() - new Date(iso).getTime();
  return diffMs > thresholdMinutes * 60 * 1000;
}

export type RiskStatus = "AMAN" | "SIAGA" | "AWAS";
