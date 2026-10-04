"use client";

import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";
import Link from "next/link";
import { monitoringRepository } from "@/features/monitoring/services/monitoringService";
import type { MonitoringNode, MonitoringReading, RiskStatus, SensorType } from "@/types/domain";
import { StatusBadge } from "@/components/status/StatusBadge";
import { usePolling } from "@/lib/usePolling";
import { LoadingSkeleton, EmptyState, ErrorState } from "@/components/ui/States";
import { formatRelativeTime, SENSOR_META } from "@/lib/constants";
import { Wifi, WifiOff, ArrowRight } from "lucide-react";

type StatusFilter = "ALL" | RiskStatus;
type ConnectionFilter = "ALL" | "ONLINE" | "OFFLINE";

export function MonitoringClient() {
  const [nodes, setNodes] = useState<MonitoringNode[]>([]);
  const [readings, setReadings] = useState<MonitoringReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>("ALL");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) {
      setError(null);
      setLoading(true);
    }
    try {
      const [nodeList, readingList] = await Promise.all([
        monitoringRepository.getNodes(),
        monitoringRepository.getLatestReadings(),
      ]);
      setNodes(nodeList);
      setReadings(readingList);
    } catch {
      if (!silent) setError("Gagal memuat data monitoring.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(() => fetchData(true));

  const getReading = (nodeId: string) => readings.find((r) => r.nodeId === nodeId);

  // ponytail: tiap node hanya menampilkan sensornya sendiri.
  const getSensorType = (node: MonitoringNode): SensorType => {
    if (node.sensorType) return node.sensorType;
    const n = node.name.toLowerCase();
    if (n.includes("moist")) return "moisture";
    if (n.includes("ultra")) return "ultrasonic";
    if (n.includes("temp")) return "temperature";
    return "risk";
  };

  const getSensorParam = (node: MonitoringNode, reading: MonitoringReading) => {
    switch (getSensorType(node)) {
      case "moisture":
        return { label: SENSOR_META.moisture.short, value: reading.soilMoisture.value, unit: reading.soilMoisture.unit };
      case "ultrasonic":
        return { label: SENSOR_META.ultrasonic.short, value: reading.ultrasonic.value, unit: reading.ultrasonic.unit };
      case "temperature":
        return { label: SENSOR_META.temperature.short, value: reading.temperature.value, unit: reading.temperature.unit };
      case "risk":
        return null;
    }
  };

  const filteredNodes = nodes.filter((node) => {
    const reading = getReading(node.id);
    const matchSearch =
      node.name.toLowerCase().includes(search.toLowerCase()) ||
      (node.blockName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      node.id.toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      statusFilter === "ALL" || reading?.riskIndex.status === statusFilter;

    const matchConnection =
      connectionFilter === "ALL" || node.connectionStatus === connectionFilter;

    return matchSearch && matchStatus && matchConnection;
  });

  // Sort AWAS → SIAGA → AMAN
  const sorted = [...filteredNodes].sort((a, b) => {
    const ra = getReading(a.id);
    const rb = getReading(b.id);
    const order = { AWAS: 0, SIAGA: 1, AMAN: 2 };
    const oa = ra ? order[ra.riskIndex.status] : 3;
    const ob = rb ? order[rb.riskIndex.status] : 3;
    return oa - ob;
  });

  if (error) {
    return (
      <div className="page-content">
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header" data-aos="fade-down" data-aos-duration="350">
        <h1 className="page-title">Monitoring</h1>
        <p className="page-subtitle">Pantau kondisi seluruh node dan blok pemantauan lahan gambut</p>
      </div>

      {/* Filters */}
      <div className="filters-bar" data-aos="fade-down" data-aos-delay="60" data-aos-duration="350">
        <div className="search-input-wrapper">
          <Search size={15} className="search-input-icon" aria-hidden="true" />
          <input
            id="monitoring-search"
            type="search"
            className="search-input"
            placeholder="Cari node, blok, atau ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari node atau blok"
          />
        </div>

        <select
          id="status-filter"
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter berdasarkan status"
        >
          <option value="ALL">Semua Status</option>
          <option value="AWAS">AWAS</option>
          <option value="SIAGA">SIAGA</option>
          <option value="AMAN">AMAN</option>
        </select>

        <select
          id="connection-filter"
          className="filter-select"
          value={connectionFilter}
          onChange={(e) => setConnectionFilter(e.target.value as ConnectionFilter)}
          aria-label="Filter berdasarkan koneksi"
        >
          <option value="ALL">Semua Koneksi</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
        </select>
      </div>

      {/* Summary chips */}
      {!loading && (
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-5)", flexWrap: "wrap" }}>
          {(["AWAS", "SIAGA", "AMAN"] as RiskStatus[]).map((status) => {
            const count = nodes.filter((n) => getReading(n.id)?.riskIndex.status === status).length;
            return (
              <button
                key={status}
                className={`status-badge ${status.toLowerCase()}`}
                style={{
                  cursor: "pointer",
                  padding: "4px 12px",
                  fontSize: "0.75rem",
                  outline: statusFilter === status ? "2px solid currentColor" : "none",
                  outlineOffset: "2px",
                }}
                onClick={() => setStatusFilter(statusFilter === status ? "ALL" : status)}
                aria-pressed={statusFilter === status}
              >
                {status}: {count} node
              </button>
            );
          })}
          <span style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", display: "flex", alignItems: "center" }}>
            Menampilkan {sorted.length} dari {nodes.length} node
          </span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="dashboard-grid grid-3">
          {Array.from({ length: 6 }).map((_, i) => <LoadingSkeleton key={i} />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="Tidak Ada Node Ditemukan"
          description="Tidak ada node yang cocok dengan filter yang dipilih."
          action={{ label: "Reset Filter", onClick: () => { setSearch(""); setStatusFilter("ALL"); setConnectionFilter("ALL"); } }}
        />
      ) : (
        <div className="dashboard-grid grid-3">
          {sorted.map((node, idx) => {
            const reading = getReading(node.id);
            const statusCls = reading?.riskIndex.status.toLowerCase() ?? "aman";
            return (
              <div
                key={node.id}
                data-aos="fade-up"
                data-aos-delay={Math.min(idx * 50, 300)}
                data-aos-duration="400"
              >
              <Link
                href={`/monitoring/${node.id}`}
                className="card node-card card-clickable"
                style={{
                  borderLeft: reading ? `3px solid var(--status-${statusCls})` : undefined,
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                }}
                aria-label={`Lihat detail ${node.name}, ${node.blockName}`}
              >
                <div className="node-card-header">
                  <div>
                    <div className="node-card-name">{node.name}</div>
                    {node.blockName && <div className="node-card-block">{node.blockName}</div>}
                  </div>
                  {reading && <StatusBadge status={reading.riskIndex.status} />}
                </div>

                {reading ? (
                  <div className="node-card-params">
                    <div className="node-card-param">
                      <span className="node-card-param-label">Indeks</span>
                      <span
                        className="node-card-param-value"
                        style={{ color: `var(--status-${statusCls})` }}
                      >
                        {reading.riskIndex.value}
                      </span>
                    </div>
                    {(() => {
                      const param = getSensorParam(node, reading);
                      return param ? (
                        <div className="node-card-param">
                          <span className="node-card-param-label">{param.label}</span>
                          <span className="node-card-param-value">
                            {param.value} {param.unit}
                          </span>
                        </div>
                      ) : null;
                    })()}
                    <div className="node-card-param">
                      <span className="node-card-param-label">ID Node</span>
                      <span className="node-card-param-value" style={{ fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>
                        {node.id}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                    Belum ada pembacaan
                  </div>
                )}

                <div className="node-card-footer">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem" }}>
                    <span style={{
                      color: node.connectionStatus === "ONLINE" ? "var(--status-aman)" : "var(--status-awas)",
                      display: "flex", alignItems: "center", gap: "4px",
                    }}
                      role="status"
                      aria-label={`Koneksi: ${node.connectionStatus}`}
                    >
                      {node.connectionStatus === "ONLINE"
                        ? <><Wifi size={11} aria-hidden="true" /> Online</>
                        : <><WifiOff size={11} aria-hidden="true" /> Offline</>}
                    </span>
                    {node.lastSeenAt && (
                      <span style={{ color: "var(--text-tertiary)" }}>
                        · {formatRelativeTime(node.lastSeenAt)}
                      </span>
                    )}
                  </div>
                  <span style={{ color: "var(--accent)", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "2px" }}>
                    Detail <ArrowRight size={11} aria-hidden="true" />
                  </span>
                </div>
              </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
