"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Wifi, WifiOff, Clock } from "lucide-react";
import { monitoringRepository } from "@/features/monitoring/services/monitoringService";
import type { MonitoringNode, MonitoringReading, TrendDataPoint, TimePeriod, SensorType } from "@/types/domain";
import { StatusBadge } from "@/components/status/StatusBadge";
import { RiskTrendChart, SoilMoistureChart, TemperatureChart, UltrasonicChart } from "@/components/charts/Charts";
import { LoadingSkeleton, ErrorState } from "@/components/ui/States";
import { formatRelativeTime, formatFullDate, SENSOR_META } from "@/lib/constants";
import { usePolling } from "@/lib/usePolling";

interface NodeDetailClientProps {
  nodeId: string;
}

// ponytail: tiap node hanya menampilkan sensornya sendiri; node Result menampilkan semuanya.
function resolveSensorType(node: MonitoringNode | null): SensorType {
  if (node?.sensorType) return node.sensorType;
  const n = node?.name.toLowerCase() ?? "";
  if (n.includes("moist")) return "moisture";
  if (n.includes("ultra")) return "ultrasonic";
  if (n.includes("temp")) return "temperature";
  return "risk";
}

export function NodeDetailClient({ nodeId }: NodeDetailClientProps) {
  const router = useRouter();
  const [node, setNode] = useState<MonitoringNode | null>(null);
  const [reading, setReading] = useState<MonitoringReading | null>(null);
  const [chartData, setChartData] = useState<TrendDataPoint[]>([]);
  const [period, setPeriod] = useState<TimePeriod>("24h");
  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMain = useCallback(async (silent = false) => {
    if (!silent) {
      setError(null);
      setLoadingMain(true);
    }
    try {
      const [nodeData, readingData] = await Promise.all([
        monitoringRepository.getNode(nodeId),
        monitoringRepository.getLatestReading(nodeId),
      ]);
      if (!nodeData) {
        if (!silent) setError(`Node ${nodeId} tidak ditemukan.`);
        return;
      }
      setNode(nodeData);
      setReading(readingData);
    } catch {
      if (!silent) setError("Gagal memuat detail node.");
    } finally {
      setLoadingMain(false);
    }
  }, [nodeId]);

  const fetchChart = useCallback(async (p: TimePeriod, silent = false) => {
    if (!silent) setLoadingChart(true);
    try {
      const data = await monitoringRepository.getTrendData(nodeId, p);
      setChartData(data);
    } finally {
      setLoadingChart(false);
    }
  }, [nodeId]);

  useEffect(() => { fetchMain(); }, [fetchMain]);
  useEffect(() => { if (!loadingMain) fetchChart(period); }, [period, fetchChart, loadingMain]);

  usePolling(() => Promise.all([fetchMain(true), fetchChart(period, true)]));

  if (error) {
    return (
      <div className="page-content">
        <button className="back-link" onClick={() => router.back()} id="back-button">
          <ArrowLeft size={16} aria-hidden="true" /> Kembali ke Monitoring
        </button>
        <ErrorState message={error} onRetry={fetchMain} />
      </div>
    );
  }

  const statusCls = reading?.riskIndex.status.toLowerCase() ?? "aman";
  const sensorType = resolveSensorType(node);
  const isRiskNode = sensorType === "risk";

  return (
    <div className="page-content">
      {/* Back */}
      <button className="back-link" onClick={() => router.back()} id="back-button">
        <ArrowLeft size={16} aria-hidden="true" /> Kembali ke Monitoring
      </button>

      {/* Node Header */}
      {loadingMain ? (
        <div style={{ marginBottom: "var(--space-6)" }} data-aos="fade-down">
          <div className="skeleton skeleton-text xl" style={{ width: "200px", marginBottom: "12px" }} />
          <div className="skeleton skeleton-text" style={{ width: "300px" }} />
        </div>
      ) : node ? (
        <div className="node-detail-header" data-aos="fade-down" data-aos-duration="400">
          <div className="node-detail-identity">
            <h1 className="node-detail-name">{node.name}</h1>
            <div className="node-detail-meta">
              {node.blockName && (
                <div className="node-detail-meta-item">
                  <MapPin size={13} aria-hidden="true" />
                  {node.blockName}
                </div>
              )}
              <div
                className="node-detail-meta-item"
                role="status"
                aria-label={`Status koneksi: ${node.connectionStatus}`}
                style={{ color: node.connectionStatus === "ONLINE" ? "var(--status-aman)" : "var(--status-awas)" }}
              >
                {node.connectionStatus === "ONLINE"
                  ? <><Wifi size={13} aria-hidden="true" /> Online</>
                  : <><WifiOff size={13} aria-hidden="true" /> Offline</>}
              </div>
              {node.lastSeenAt && (
                <div className="node-detail-meta-item">
                  <Clock size={13} aria-hidden="true" />
                  Data terakhir: {formatRelativeTime(node.lastSeenAt)}
                </div>
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-tertiary)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: "4px" }}>
                {node.id}
              </span>
            </div>
          </div>
          {reading && <StatusBadge status={reading.riskIndex.status} size="md" />}
        </div>
      ) : null}

      {/* Current Reading Cards: hanya sensor milik node ini */}
      {loadingMain ? (
        <div className="dashboard-grid grid-3" style={{ marginBottom: "var(--space-5)" }}>
          {[0,1].map((i) => <div key={i} data-aos="fade-up" data-aos-delay={i*60}><LoadingSkeleton /></div>)}
        </div>
      ) : reading ? (
        <div className="dashboard-grid grid-3" style={{ marginBottom: "var(--space-5)" }}>
          {/* Risk Index */}
          <div className="card" style={{ borderTop: `3px solid var(--status-${statusCls})` }} data-aos="fade-up" data-aos-delay="0">
            <div className="card-label" style={{ marginBottom: "var(--space-3)" }}>Indeks Kerawanan</div>
            <div className={`risk-index-value ${statusCls}`} aria-label={`Indeks Kerawanan: ${reading.riskIndex.value}`}>
              {reading.riskIndex.value}
              <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: "4px" }}>/100</span>
            </div>
            <StatusBadge status={reading.riskIndex.status} />
            <div style={{ marginTop: "12px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              {formatFullDate(reading.riskIndex.calculatedAt)}
            </div>
          </div>

          {(sensorType === "moisture" || isRiskNode) && (
            <div className="card" data-aos="fade-up" data-aos-delay="80">
              <div className="card-label" style={{ marginBottom: "var(--space-3)" }}>{SENSOR_META.moisture.label}</div>
              <div className="param-value">
                <span>{reading.soilMoisture.value}</span>
                <span className="param-unit">{reading.soilMoisture.unit}</span>
              </div>
              {reading.soilMoisture.unit === "%" && (
                <div className="risk-scale-bar" role="progressbar" aria-valuenow={reading.soilMoisture.value} aria-valuemin={0} aria-valuemax={100} style={{ marginTop: "12px" }}>
                  <div
                    className="risk-scale-fill"
                    style={{
                      width: `${reading.soilMoisture.value}%`,
                      background: reading.soilMoisture.value < 35
                        ? "var(--status-awas)"
                        : reading.soilMoisture.value < 50
                        ? "var(--status-siaga)"
                        : "var(--status-aman)",
                    }}
                  />
                </div>
              )}
              <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                {formatFullDate(reading.recordedAt)}
              </div>
            </div>
          )}

          {(sensorType === "ultrasonic" || isRiskNode) && (
            <div className="card" data-aos="fade-up" data-aos-delay="120">
              <div className="card-label" style={{ marginBottom: "var(--space-3)" }}>{SENSOR_META.ultrasonic.label}</div>
              <div className="param-value">
                <span>{reading.ultrasonic.value}</span>
                <span className="param-unit">{reading.ultrasonic.unit}</span>
              </div>
              <div className="param-desc">jarak terbaca sensor</div>
              <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                {formatFullDate(reading.recordedAt)}
              </div>
            </div>
          )}

          {(sensorType === "temperature" || isRiskNode) && (
            <div className="card" data-aos="fade-up" data-aos-delay="160">
              <div className="card-label" style={{ marginBottom: "var(--space-3)" }}>{SENSOR_META.temperature.label}</div>
              <div className="param-value">
                <span>{reading.temperature.value}</span>
                <span className="param-unit">{reading.temperature.unit}</span>
              </div>
              <div className="param-desc">suhu udara sekitar sensor</div>
              <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                {formatFullDate(reading.recordedAt)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: "var(--space-5)", textAlign: "center", padding: "var(--space-8)", color: "var(--text-secondary)" }}>
          Belum ada pembacaan sensor untuk node ini.
        </div>
      )}

      {/* Charts: grafik sensor milik node + tren indeks */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <RiskTrendChart
          data={chartData}
          period={period}
          onPeriodChange={setPeriod}
          isLoading={loadingChart || loadingMain}
          title={`Tren Indeks Kerawanan, ${node?.name ?? nodeId}`}
        />
        <div className="dashboard-grid grid-2">
          {(sensorType === "ultrasonic" || isRiskNode) && (
            <UltrasonicChart
              data={chartData}
              period={period}
              onPeriodChange={setPeriod}
              isLoading={loadingChart || loadingMain}
            />
          )}
          {(sensorType === "moisture" || isRiskNode) && (
            <SoilMoistureChart
              data={chartData}
              period={period}
              onPeriodChange={setPeriod}
              isLoading={loadingChart || loadingMain}
            />
          )}
          {(sensorType === "temperature" || isRiskNode) && (
            <TemperatureChart
              data={chartData}
              period={period}
              onPeriodChange={setPeriod}
              isLoading={loadingChart || loadingMain}
            />
          )}
        </div>
      </div>
    </div>
  );
}
