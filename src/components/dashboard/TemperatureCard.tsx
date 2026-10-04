"use client";

import { Thermometer } from "lucide-react";
import type { MonitoringReading } from "@/types/domain";
import { formatTimestamp } from "@/lib/constants";

interface TemperatureCardProps {
  reading: MonitoringReading | null;
}

export function TemperatureCard({ reading }: TemperatureCardProps) {
  if (!reading) {
    return (
      <div className="card" id="temperature-card">
        <div className="card-label"><Thermometer size={13} className="card-icon" aria-hidden="true" />Suhu</div>
        <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem", marginTop: "var(--space-5)", height: 100, display: "flex", alignItems: "center" }}>Tidak ada data</div>
      </div>
    );
  }

  const { temperature, recordedAt } = reading;
  const isWarm = temperature.value >= 34;
  const isHot = temperature.value >= 38;
  const valueColor = isHot ? "var(--status-awas)" : isWarm ? "var(--status-siaga)" : "var(--text-primary)";
  // Skala normalisasi risiko 25–45°C, sama seperti perhitungan IKG server.
  const pct = Math.min(100, Math.max(0, ((temperature.value - 25) / 20) * 100));

  return (
    <div className="card" id="temperature-card">
      <div className="card-header">
        <div className="card-label">
          <Thermometer size={13} className="card-icon" aria-hidden="true" />
          Suhu
        </div>
        {isHot && <span className="status-badge awas" role="status" aria-label="Suhu tinggi">Panas</span>}
        {isWarm && !isHot && <span className="status-badge siaga" role="status" aria-label="Suhu menghangat">Hangat</span>}
      </div>

      <div className="param-value" aria-label={`Suhu: ${temperature.value} ${temperature.unit}`}>
        <span style={{ color: valueColor }}>{temperature.value}</span>
        <span className="param-unit">{temperature.unit}</span>
      </div>

      <div className="param-desc">suhu lingkungan sensor</div>

      {/* Skala 25–45°C */}
      <div className="metric-visual">
      <div className="risk-scale-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="risk-scale-fill"
          style={{
            width: `${pct}%`,
            background: isHot ? "var(--status-awas)" : isWarm ? "var(--status-siaga)" : "var(--status-aman)",
          }}
        />
      </div>
      </div>

      <div className="last-update-inline">{formatTimestamp(recordedAt)}</div>
    </div>
  );
}
