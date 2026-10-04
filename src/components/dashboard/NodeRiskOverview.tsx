"use client";

import Link from "next/link";
import { ArrowRight, Wifi, WifiOff } from "lucide-react";
import type { MonitoringNode, MonitoringReading, SensorType } from "@/types/domain";
import { StatusBadge } from "@/components/status/StatusBadge";
import { formatRelativeTime } from "@/lib/constants";

interface NodeRiskOverviewProps {
  nodes: MonitoringNode[];
  readings: MonitoringReading[];
}

export function NodeRiskOverview({ nodes, readings }: NodeRiskOverviewProps) {
  const getReading = (nodeId: string) =>
    readings.find((r) => r.nodeId === nodeId);

  // ponytail: tiap baris hanya menampilkan sensor milik node tersebut.
  const getSensorType = (node: MonitoringNode): SensorType => {
    if (node.sensorType) return node.sensorType;
    const n = node.name.toLowerCase();
    if (n.includes("moist")) return "moisture";
    if (n.includes("ultra")) return "ultrasonic";
    if (n.includes("temp")) return "temperature";
    return "risk";
  };

  const getSensorText = (node: MonitoringNode, reading: MonitoringReading): string => {
    switch (getSensorType(node)) {
      case "moisture":
        return `${reading.soilMoisture.value} ${reading.soilMoisture.unit}`;
      case "ultrasonic":
        return `${reading.ultrasonic.value} ${reading.ultrasonic.unit}`;
      case "temperature":
        return `${reading.temperature.value} ${reading.temperature.unit}`;
      case "risk":
        return "—";
    }
  };

  // Sort: AWAS → SIAGA → AMAN → offline
  const sorted = [...nodes].sort((a, b) => {
    const ra = getReading(a.id);
    const rb = getReading(b.id);
    const order = { AWAS: 0, SIAGA: 1, AMAN: 2 };
    const oa = ra ? order[ra.riskIndex.status] : 3;
    const ob = rb ? order[rb.riskIndex.status] : 3;
    return oa - ob;
  });

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{
        padding: "var(--space-4) var(--space-5)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <h2 className="text-section-title" style={{ fontSize: "0.9375rem" }}>Area Pemantauan</h2>
        <Link
          href="/monitoring"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "0.8125rem",
            color: "var(--accent)",
            fontWeight: 500,
          }}
        >
          Lihat semua <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>

      <div className="scroll-x">
        <table className="history-table" aria-label="Daftar node pemantauan">
          <thead>
            <tr>
              <th>Node / Blok</th>
              <th>Status</th>
              <th>Indeks</th>
              <th>Sensor</th>
              <th>Koneksi</th>
              <th>Update</th>
              <th aria-label="Aksi" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((node) => {
              const reading = getReading(node.id);
              return (
                <tr key={node.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{node.name}</div>
                    {node.blockName && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{node.blockName}</div>
                    )}
                  </td>
                  <td>
                    {reading ? <StatusBadge status={reading.riskIndex.status} /> : (
                      <span style={{ color: "var(--text-tertiary)", fontSize: "0.75rem" }}>—</span>
                    )}
                  </td>
                  <td>
                    {reading ? (
                      <span style={{
                        fontWeight: 700,
                        fontFeatureSettings: "'tnum'",
                        color: reading.riskIndex.status === "AWAS"
                          ? "var(--status-awas)"
                          : reading.riskIndex.status === "SIAGA"
                          ? "var(--status-siaga)"
                          : "var(--status-aman)",
                      }}>
                        {reading.riskIndex.value}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ fontFeatureSettings: "'tnum'" }}>
                    {reading ? `${getSensorText(node, reading)}` : "—"}
                  </td>
                  <td>
                    <span style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.8125rem",
                      color: node.connectionStatus === "ONLINE" ? "var(--status-aman)" : "var(--status-awas)",
                    }}
                      role="status"
                      aria-label={`Koneksi: ${node.connectionStatus}`}
                    >
                      {node.connectionStatus === "ONLINE"
                        ? <><Wifi size={12} aria-hidden="true" /> Online</>
                        : <><WifiOff size={12} aria-hidden="true" /> Offline</>}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                    {node.lastSeenAt ? formatRelativeTime(node.lastSeenAt) : "—"}
                  </td>
                  <td>
                    <Link
                      href={`/monitoring/${node.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.75rem",
                        color: "var(--accent)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                      aria-label={`Lihat detail ${node.name}`}
                    >
                      Detail <ArrowRight size={11} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
