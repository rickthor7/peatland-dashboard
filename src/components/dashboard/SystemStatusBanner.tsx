"use client";

import { ShieldCheck, AlertTriangle, AlertOctagon, Server, Clock, Database, Radio } from "lucide-react";
import type { SystemStatus } from "@/types/domain";
import { formatTimestamp } from "@/lib/constants";

const ICONS = {
  AMAN: ShieldCheck,
  SIAGA: AlertTriangle,
  AWAS: AlertOctagon,
};

const DESCRIPTIONS = {
  AMAN: "Seluruh parameter hidrologi berada dalam rentang aman.",
  SIAGA: "Sebagian parameter memerlukan perhatian dan pemantauan.",
  AWAS: "Kondisi kerentanan tinggi terdeteksi. Tindakan segera diperlukan.",
};

interface SystemStatusBannerProps {
  status: SystemStatus;
}

export function SystemStatusBanner({ status }: SystemStatusBannerProps) {
  const cls = status.overallStatus.toLowerCase();
  const Icon = ICONS[status.overallStatus];
  const isDummy = status.dataMode === "dummy";

  return (
    <div
      className={`system-status-banner ${cls}${isDummy ? " is-dummy" : ""}`}
      role="region"
      aria-label="Status sistem keseluruhan"
      id="system-status-banner"
    >
      <div className="system-status-main">
        <div className={`system-status-icon-wrap ${cls}`} aria-hidden="true">
          <Icon size={26} strokeWidth={2} />
        </div>
        <div className="system-status-text">
          <div className="system-status-eyebrow">
            Status Sistem
            {isDummy && (
              <span className="dummy-mode-badge" role="status" aria-label="Mode simulasi aktif">
                <Radio size={10} aria-hidden="true" />
                Mode Simulasi
              </span>
            )}
          </div>
          <div
            className={`system-status-value ${cls}`}
            role="status"
            aria-live="polite"
          >
            {status.overallStatus}
          </div>
          <div className="system-status-desc">
            {isDummy
              ? "Koneksi database terputus — data dummy dibuat langsung di website (tanpa MQTT) dan status dipaksa aman."
              : DESCRIPTIONS[status.overallStatus]}
          </div>
        </div>
      </div>

      <div className="system-status-right">
        <div>
          <div className="system-status-node-count">
            {status.onlineNodes}
            <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-secondary)" }}>
              /{status.totalNodes}
            </span>
          </div>
          <div className="system-status-node-label">
            <Server size={11} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />
            node online
          </div>
        </div>
        <div className="system-status-time" title="Waktu update terakhir">
          {isDummy ? (
            <Database size={10} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />
          ) : (
            <Clock size={10} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />
          )}
          {isDummy ? "Data dummy" : formatTimestamp(status.lastUpdatedAt)}
        </div>
      </div>
    </div>
  );
}
