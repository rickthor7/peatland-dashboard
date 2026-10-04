"use client";

import { Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MonitoringReading } from "@/types/domain";
import { StatusBadge } from "@/components/status/StatusBadge";
import { formatTimestamp } from "@/lib/constants";

interface RiskSummaryCardProps {
  reading: MonitoringReading | null;
  isLoading?: boolean;
}

export function RiskSummaryCard({ reading }: RiskSummaryCardProps) {
  if (!reading) {
    return (
      <div className="card" id="risk-summary-card">
        <div className="card-label">
          <Gauge size={13} className="card-icon" aria-hidden="true" />
          Indeks Kerawanan
        </div>
        <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem", marginTop: "var(--space-5)", height: 100, display: "flex", alignItems: "center" }}>
          Tidak ada data
        </div>
      </div>
    );
  }

  const { riskIndex } = reading;
  const cls = riskIndex.status.toLowerCase();
  const diff = riskIndex.previousValue !== undefined ? riskIndex.value - riskIndex.previousValue : null;

  const fillColor =
    riskIndex.status === "AWAS"  ? "linear-gradient(90deg, var(--status-aman-dim), var(--status-siaga), var(--status-awas))" :
    riskIndex.status === "SIAGA" ? "linear-gradient(90deg, var(--status-aman-dim), var(--status-siaga))" :
    "var(--status-aman)";

  return (
    <div className="card" id="risk-summary-card">
      <div className="card-header">
        <div className="card-label">
          <Gauge size={13} className="card-icon" aria-hidden="true" />
          Indeks Kerawanan
        </div>
        <StatusBadge status={riskIndex.status} />
      </div>

      <div
        className={`risk-index-value ${cls}`}
        aria-label={`Indeks Kerawanan Gambut: ${riskIndex.value} dari 100`}
      >
        {riskIndex.value}
        <span style={{ fontSize: "1.25rem", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: "4px", letterSpacing: 0 }}>
          /100
        </span>
      </div>

      {diff !== null && (
        <div className={`risk-change-indicator ${diff > 0 ? "up" : diff < 0 ? "down" : "neutral"}`}>
          {diff > 0 ? <TrendingUp size={12} aria-hidden="true" /> :
           diff < 0 ? <TrendingDown size={12} aria-hidden="true" /> :
           <Minus size={12} aria-hidden="true" />}
          {Math.abs(diff) > 0 ? `${diff > 0 ? "+" : ""}${diff} dari sebelumnya` : "Tidak ada perubahan"}
        </div>
      )}

      <div className="metric-visual">
      <div
        className="risk-scale-bar"
        role="progressbar"
        aria-valuenow={riskIndex.value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Skala indeks kerawanan"
      >
        <div
          className="risk-scale-fill"
          style={{ width: `${riskIndex.value}%`, background: fillColor }}
        />
      </div>
      </div>

      <div className="last-update-inline">
        <span>Dihitung {formatTimestamp(riskIndex.calculatedAt)}</span>
      </div>
    </div>
  );
}
