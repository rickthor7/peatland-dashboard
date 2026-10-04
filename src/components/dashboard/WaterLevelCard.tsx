"use client";

import { Droplets } from "lucide-react";
import type { MonitoringReading } from "@/types/domain";
import { formatTimestamp } from "@/lib/constants";

interface WaterLevelCardProps {
  reading: MonitoringReading | null;
}

export function WaterLevelCard({ reading }: WaterLevelCardProps) {
  if (!reading) {
    return (
      <div className="card" id="water-level-card">
        <div className="card-label"><Droplets size={13} className="card-icon" aria-hidden="true" />Tinggi Muka Air</div>
        <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem", marginTop: "var(--space-5)", height: 100, display: "flex", alignItems: "center" }}>Tidak ada data</div>
      </div>
    );
  }

  const { waterLevel, recordedAt } = reading;
  const isLow      = waterLevel.value < -35;
  const isVeryLow  = waterLevel.value < -45;
  const valueColor = isVeryLow ? "var(--status-awas)" : isLow ? "var(--status-siaga)" : "var(--text-primary)";

  return (
    <div className="card" id="water-level-card">
      <div className="card-header">
        <div className="card-label">
          <Droplets size={13} className="card-icon" aria-hidden="true" />
          Tinggi Muka Air
        </div>
        {isVeryLow && <span className="status-badge awas" role="status" aria-label="TMA sangat rendah — kritis">Kritis</span>}
        {isLow && !isVeryLow && <span className="status-badge siaga" role="status" aria-label="TMA rendah">Rendah</span>}
      </div>

      <div className="param-value" aria-label={`TMA: ${waterLevel.value} ${waterLevel.unit} dari permukaan`}>
        <span style={{ color: valueColor }}>{waterLevel.value}</span>
        <span className="param-unit">{waterLevel.unit}</span>
      </div>

      <div className="param-desc">dari permukaan tanah</div>

      {/* Water depth visual */}
      <div className="metric-visual">
      <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: 32, width: "100%" }}>
        {[-20, -30, -40, -50, -60].map((threshold) => (
          <div
            key={threshold}
            style={{
              flex: 1,
              height: `${Math.min(100, Math.max(20, (Math.abs(threshold) / 70) * 100))}%`,
              background: waterLevel.value <= threshold
                ? "var(--chart-water)"
                : "var(--bg-overlay)",
              borderRadius: "3px 3px 0 0",
              transition: "background var(--transition-base)",
              opacity: waterLevel.value <= threshold ? 1 : 0.3,
            }}
            aria-hidden="true"
          />
        ))}
      </div>
      </div>

      <div className="last-update-inline">{formatTimestamp(recordedAt)}</div>
    </div>
  );
}
