// Perhitungan Indeks Kerawanan Gambut (IKG / HVI) — sumber tunggal.
//
// dipakai dua sisi:
//  1. server  : /api/webhook (data dari MQTT/EMQX → sensor_logs)
//  2. client  : mode dummy saat koneksi database terputus (data dibuat di browser)
//
// HVI: normalisasi tiap sensor ke 0-1, clamp, kali bobot, lalu x100.
//   D_SM  : makin kering tanah → makin tinggi
//   D_T   : makin panas suhu   → makin tinggi
//   D_TMA : makin dalam muka air → makin tinggi (D = max(0, -tma); genangan → 0)

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface RiskBreakdown {
  /** Indeks Kerawanan 0-100 */
  index: number;
  /** Normalisasi kelembaban tanah 0-1 */
  dSM: number;
  /** Normalisasi suhu 0-1 */
  dT: number;
  /** Normalisasi kedalaman muka air 0-1 */
  dTMA: number;
}

/**
 * @param tma         tinggi muka air (cm, negatif = di bawah permukaan tanah)
 * @param moisture    kelembaban tanah (%)
 * @param temperature suhu lingkungan (°C)
 */
export function computeRisk(tma: number, moisture: number, temperature: number): RiskBreakdown {
  const distance = Math.max(0, -tma);
  const dSM = clamp01((80 - moisture) / 80);
  const dT = clamp01((temperature - 20) / (40 - 20));
  const dTMA = clamp01(distance / 150);

  return {
    index: Math.round(100 * (0.3 * dSM + 0.2 * dT + 0.5 * dTMA)),
    dSM: Math.round(dSM * 100),
    dT: Math.round(dT * 100),
    dTMA: Math.round(dTMA * 100),
  };
}

/** IKG 0-100 → status berjenjang */
export function toRiskStatus(index: number): "AMAN" | "SIAGA" | "AWAS" {
  return index >= 70 ? "AWAS" : index >= 40 ? "SIAGA" : "AMAN";
}
