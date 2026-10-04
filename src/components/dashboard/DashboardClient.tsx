"use client";

import { useEffect, useState, useCallback } from "react";
import { monitoringRepository } from "@/features/monitoring/services/monitoringService";
import type { SystemStatus, MonitoringReading, MonitoringNode, TrendDataPoint, TimePeriod } from "@/types/domain";
import { SystemStatusBanner } from "./SystemStatusBanner";
import { RiskSummaryCard } from "./RiskSummaryCard";
import { WaterLevelCard } from "./WaterLevelCard";
import { SoilMoistureCard } from "./SoilMoistureCard";
import { TemperatureCard } from "./TemperatureCard";
import { RiskTrendChart, WaterLevelChart, SoilMoistureChart, TemperatureChart } from "@/components/charts/Charts";
import { NodeRiskOverview } from "./NodeRiskOverview";
import { LoadingSkeleton, ErrorState } from "@/components/ui/States";
import { usePolling } from "@/lib/usePolling";

export function DashboardClient() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [latestReading, setLatestReading] = useState<MonitoringReading | null>(null);
  const [nodes, setNodes] = useState<MonitoringNode[]>([]);
  const [allReadings, setAllReadings] = useState<MonitoringReading[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<TimePeriod>("24h");
  const [wlPeriod, setWlPeriod] = useState<TimePeriod>("24h");
  const [smPeriod, setSmPeriod] = useState<TimePeriod>("24h");
  const [tpPeriod, setTpPeriod] = useState<TimePeriod>("24h");
  const [wlData, setWlData] = useState<TrendDataPoint[]>([]);
  const [smData, setSmData] = useState<TrendDataPoint[]>([]);
  const [tpData, setTpData] = useState<TrendDataPoint[]>([]);

  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [loadingWl, setLoadingWl] = useState(false);
  const [loadingSm, setLoadingSm] = useState(false);
  const [loadingTp, setLoadingTp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMain = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const [status, reading, nodeList, readings] = await Promise.all([
        monitoringRepository.getSystemStatus(),
        monitoringRepository.getLatestReading(),
        monitoringRepository.getNodes(),
        monitoringRepository.getLatestReadings(),
      ]);
      setSystemStatus(status);
      setLatestReading(reading);
      setNodes(nodeList);
      setAllReadings(readings);
    } catch {
      if (!silent) setError("Gagal memuat data dashboard.");
    } finally {
      setLoadingMain(false);
    }
  }, []);

  const fetchTrend = useCallback(async (period: TimePeriod, silent = false) => {
    if (!silent) setLoadingTrend(true);
    try {
      const data = await monitoringRepository.getGlobalTrendData(period);
      setTrendData(data);
    } finally {
      setLoadingTrend(false);
    }
  }, []);

  const fetchWl = useCallback(async (period: TimePeriod, silent = false) => {
    if (!silent) setLoadingWl(true);
    try {
      const data = await monitoringRepository.getGlobalTrendData(period);
      setWlData(data);
    } finally {
      setLoadingWl(false);
    }
  }, []);

  const fetchSm = useCallback(async (period: TimePeriod, silent = false) => {
    if (!silent) setLoadingSm(true);
    try {
      const data = await monitoringRepository.getGlobalTrendData(period);
      setSmData(data);
    } finally {
      setLoadingSm(false);
    }
  }, []);

  const fetchTp = useCallback(async (period: TimePeriod, silent = false) => {
    if (!silent) setLoadingTp(true);
    try {
      const data = await monitoringRepository.getGlobalTrendData(period);
      setTpData(data);
    } finally {
      setLoadingTp(false);
    }
  }, []);

  useEffect(() => {
    fetchMain();
    fetchTrend("24h");
    fetchWl("24h");
    fetchSm("24h");
    fetchTp("24h");
  }, [fetchMain, fetchTrend, fetchWl, fetchSm, fetchTp]);

  useEffect(() => { fetchTrend(trendPeriod); }, [trendPeriod, fetchTrend]);
  useEffect(() => { fetchWl(wlPeriod); }, [wlPeriod, fetchWl]);
  useEffect(() => { fetchSm(smPeriod); }, [smPeriod, fetchSm]);
  useEffect(() => { fetchTp(tpPeriod); }, [tpPeriod, fetchTp]);

  usePolling(() =>
    Promise.all([fetchMain(true), fetchTrend(trendPeriod, true), fetchWl(wlPeriod, true), fetchSm(smPeriod, true), fetchTp(tpPeriod, true)])
  );

  if (error) {
    return (
      <div className="page-content">
        <ErrorState message={error} onRetry={fetchMain} />
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* System Status Banner */}
      <div data-aos="fade-down" data-aos-duration="400" style={{ marginBottom: "var(--space-6)" }}>
        {loadingMain ? (
          <div className="skeleton" style={{ height: 96, borderRadius: "var(--radius-lg)" }} />
        ) : systemStatus ? (
          <SystemStatusBanner status={systemStatus} />
        ) : null}
      </div>

      {/* Metric Cards — 2x2 */}
      <div className="dashboard-grid grid-2 metric-cards" style={{ marginBottom: "var(--space-5)" }}>
        {loadingMain ? (
          <>
            {[0,1,2,3].map((i) => (
              <div key={i} data-aos="fade-up" data-aos-delay={i * 60}>
                <LoadingSkeleton />
              </div>
            ))}
          </>
        ) : (
          <>
            <div data-aos="fade-up" data-aos-delay="0" data-aos-duration="400">
              <RiskSummaryCard reading={latestReading} />
            </div>
            <div data-aos="fade-up" data-aos-delay="60" data-aos-duration="400">
              <WaterLevelCard reading={latestReading} />
            </div>
            <div data-aos="fade-up" data-aos-delay="120" data-aos-duration="400">
              <SoilMoistureCard reading={latestReading} />
            </div>
            <div data-aos="fade-up" data-aos-delay="180" data-aos-duration="400">
              <TemperatureCard reading={latestReading} />
            </div>
          </>
        )}
      </div>

      {/* Charts — 2x2 */}
      <div className="dashboard-grid grid-2" style={{ marginBottom: "var(--space-5)" }}>
        <div data-aos="fade-up" data-aos-delay="0" data-aos-duration="450">
          <RiskTrendChart
            data={trendData}
            period={trendPeriod}
            onPeriodChange={setTrendPeriod}
            isLoading={loadingTrend}
          />
        </div>
        <div data-aos="fade-up" data-aos-delay="80" data-aos-duration="450">
          <WaterLevelChart
            data={wlData}
            period={wlPeriod}
            onPeriodChange={setWlPeriod}
            isLoading={loadingWl}
          />
        </div>
        <div data-aos="fade-up" data-aos-delay="160" data-aos-duration="450">
          <SoilMoistureChart
            data={smData}
            period={smPeriod}
            onPeriodChange={setSmPeriod}
            isLoading={loadingSm}
          />
        </div>
        <div data-aos="fade-up" data-aos-delay="240" data-aos-duration="450">
          <TemperatureChart
            data={tpData}
            period={tpPeriod}
            onPeriodChange={setTpPeriod}
            isLoading={loadingTp}
          />
        </div>
      </div>

      {/* Node Overview */}
      {!loadingMain && (
        <div data-aos="fade-up" data-aos-duration="400">
          <NodeRiskOverview nodes={nodes} readings={allReadings} />
        </div>
      )}
    </div>
  );
}
