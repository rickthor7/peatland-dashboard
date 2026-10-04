"use client";

import { Leaf } from "lucide-react";
import type { MonitoringReading } from "@/types/domain";
import { formatTimestamp } from "@/lib/constants";

interface SoilMoistureCardProps {
  reading: MonitoringReading | null;
}

const MOISTURE_ZONES = [
  { label: "Kering", max: 30, color: "var(--status-awas)" },
  { label: "Rendah", max: 50, color: "var(--status-siaga)" },
  { label: "Normal", max: 75, color: "var(--status-aman)" },
  { label: "Lembab", max: 100, color: "var(--chart-water)" },
];

export function SoilMoistureCard({ reading }: SoilMoistureCardProps) {
  if (!reading) {
    return (
      <div className="card" id="soil-moisture-card">
        <div className="card-label"><Leaf size={13} className="card-icon" aria-hidden="true" />Kelembaban Tanah</div>
        <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem", marginTop: "var(--space-5)", height: 100, display: "flex", alignItems: "center" }}>Tidak ada data</div>
      </div>
    );
  }

  const { soilMoisture, recordedAt } = reading;
  const isDry      = soilMoisture.value < 50;
  const isVeryDry  = soilMoisture.value < 30;
  const activeZone = MOISTURE_ZONES.find((z) => soilMoisture.value <= z.max) ?? MOISTURE_ZONES[3];
  const pct        = soilMoisture.unit === "%" ? soilMoisture.value : null;

  return (
    <div className="card" id="soil-moisture-card">
      <div className="card-header">
        <div className="card-label">
          <Leaf size={13} className="card-icon" aria-hidden="true" />
          Kelembaban Tanah
        </div>
        {isVeryDry && <span className="status-badge awas" role="status" aria-label="Kelembaban sangat rendah">Kering</span>}
        {isDry && !isVeryDry && <span className="status-badge siaga" role="status" aria-label="Kelembaban rendah">Rendah</span>}
      </div>

      <div className="param-value" aria-label={`Kelembaban Tanah: ${soilMoisture.value} ${soilMoisture.unit}`}>
        <span style={{ color: activeZone.color }}>{soilMoisture.value}</span>
        <span className="param-unit">{soilMoisture.unit}</span>
      </div>

      <div className="param-desc">zona: {activeZone.label}</div>

      {/* Segmented moisture bar */}
      {pct !== null && (
        <div className="metric-visual">
        <div style={{ display: "flex", gap: "3px", alignItems: "stretch", height: "6px", width: "100%" }}>
          {MOISTURE_ZONES.map((zone, i) => {
            const prevMax = i === 0 ? 0 : MOISTURE_ZONES[i - 1].max;
            const segPct = zone.max - prevMax;
            const filled = pct >= zone.max
              ? 100
              : pct > prevMax
              ? ((pct - prevMax) / segPct) * 100
              : 0;
            return (
              <div
                key={zone.label}
                style={{ flex: segPct, background: "var(--bg-overlay)", borderRadius: "3px", overflow: "hidden" }}
                aria-hidden="true"
              >
                <div
                  style={{
                    width: `${filled}%`,
                    height: "100%",
                    background: zone.color,
                    borderRadius: "3px",
                    transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-2)" }}>
          {MOISTURE_ZONES.map((z) => (
            <span key={z.label} style={{ fontSize: "0.5625rem", color: "var(--text-tertiary)", fontFamily: "var(--font-body)", letterSpacing: "0.04em" }}>
              {z.label}
            </span>
          ))}
        </div>
        </div>
      )}

      <div className="last-update-inline">{formatTimestamp(recordedAt)}</div>
    </div>
  );
}
