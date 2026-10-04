"use client";

import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";
import type { TrendDataPoint, TimePeriod } from "@/types/domain";
import { RISK_THRESHOLDS } from "@/lib/constants";

/* ══════════════════════════════════════════════════════════
   SHARED TYPES
   ══════════════════════════════════════════════════════════ */

interface ChartProps {
  data: TrendDataPoint[];
  period: TimePeriod;
  onPeriodChange: (p: TimePeriod) => void;
  isLoading?: boolean;
  title?: string;
}

const PERIODS: TimePeriod[] = ["24h", "7d", "30d"];

function PeriodTabs({ period, onChange }: { period: TimePeriod; onChange: (p: TimePeriod) => void }) {
  return (
    <div className="chart-period-tabs" role="tablist" aria-label="Pilih periode waktu">
      {PERIODS.map((p) => (
        <button
          key={p}
          className={`chart-period-tab${period === p ? " active" : ""}`}
          onClick={() => onChange(p)}
          role="tab"
          aria-selected={period === p}
          id={`period-${p}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

/* ── Shared tooltip style ─────────────────────────────── */

const tooltipStyle = {
  backgroundColor: "var(--bg-overlay)",
  border: "1px solid var(--border-default)",
  borderRadius: "10px",
  padding: "10px 14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.75rem",
  color: "var(--text-primary)",
};

const labelStyle = {
  fontFamily: "'Outfit', sans-serif",
  fontSize: "0.6875rem",
  color: "var(--text-secondary)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  marginBottom: "4px",
};

/* ── Skeleton Chart ───────────────────────────────────── */

function ChartSkeleton() {
  return (
    <div style={{ height: 220, display: "flex", alignItems: "flex-end", gap: "3%", padding: "0 4%", marginTop: "var(--space-4)" }}>
      {[0.4, 0.7, 0.55, 0.85, 0.65, 0.9, 0.7, 0.5, 0.75, 0.6, 0.8, 0.45].map((h, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ flex: 1, height: `${h * 100}%`, borderRadius: "4px 4px 0 0" }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   RISK TREND CHART
   ══════════════════════════════════════════════════════════ */

export function RiskTrendChart({ data, period, onPeriodChange, isLoading, title }: ChartProps) {
  return (
    <div className="card chart-container" style={{ padding: 0 }}>
      <div style={{ padding: "var(--space-5) var(--space-5) 0" }}>
        <div className="chart-header">
          <div>
            <div className="chart-title">{title ?? "Tren Indeks Kerawanan Gambut"}</div>
            <div className="chart-subtitle">Nilai IKG 0–100 · batas SIAGA ≥{RISK_THRESHOLDS.SIAGA}, AWAS ≥{RISK_THRESHOLDS.AWAS}</div>
          </div>
          <PeriodTabs period={period} onChange={onPeriodChange} />
        </div>
      </div>

      <div style={{ padding: "0 var(--space-2) var(--space-4)" }}>
        {isLoading ? (
          <ChartSkeleton />
        ) : data.length === 0 ? (
          <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
            Belum ada data untuk periode ini
          </div>
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-risk)" stopOpacity={0.25} />
                    <stop offset="80%" stopColor="var(--chart-risk)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={4}
                  width={32}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={labelStyle}
                  formatter={(val: unknown) => [`${val ?? ""}`, "IKG"]}
                  cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                />
                {/* Threshold lines */}
                <ReferenceLine
                  y={RISK_THRESHOLDS.SIAGA}
                  stroke="var(--status-siaga)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                  label={{ value: "SIAGA", position: "insideTopRight", fontSize: 9, fill: "var(--status-siaga)", fontFamily: "var(--font-display)", fontWeight: 700 }}
                />
                <ReferenceLine
                  y={RISK_THRESHOLDS.AWAS}
                  stroke="var(--status-awas)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                  label={{ value: "AWAS", position: "insideTopRight", fontSize: 9, fill: "var(--status-awas)", fontFamily: "var(--font-display)", fontWeight: 700 }}
                />
                <Area
                  type="monotone"
                  dataKey="riskIndex"
                  stroke="var(--chart-risk)"
                  strokeWidth={2}
                  fill="url(#riskGrad)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--bg-surface)", fill: "var(--chart-risk)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   WATER LEVEL CHART
   ══════════════════════════════════════════════════════════ */

export function WaterLevelChart({ data, period, onPeriodChange, isLoading }: ChartProps) {
  return (
    <div className="card chart-container" style={{ padding: 0 }}>
      <div style={{ padding: "var(--space-5) var(--space-5) 0" }}>
        <div className="chart-header">
          <div>
            <div className="chart-title">Tinggi Muka Air</div>
            <div className="chart-subtitle">TMA dalam cm dari permukaan tanah</div>
          </div>
          <PeriodTabs period={period} onChange={onPeriodChange} />
        </div>
      </div>

      <div style={{ padding: "0 var(--space-2) var(--space-4)" }}>
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top: 16, right: 16, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-water)" stopOpacity={0.22} />
                    <stop offset="85%" stopColor="var(--chart-water)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false} tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false} tickMargin={4}
                  width={36}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={labelStyle}
                  formatter={(val: unknown) => [`${val ?? ""} cm`, "TMA"]}
                  cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="waterLevel"
                  stroke="var(--chart-water)"
                  strokeWidth={2}
                  fill="url(#waterGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--bg-surface)", fill: "var(--chart-water)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ULTRASONIC CHART (jarak, cm)
   ══════════════════════════════════════════════════════════ */

export function UltrasonicChart({ data, period, onPeriodChange, isLoading }: ChartProps) {
  return (
    <div className="card chart-container" style={{ padding: 0 }}>
      <div style={{ padding: "var(--space-5) var(--space-5) 0" }}>
        <div className="chart-header">
          <div>
            <div className="chart-title">Jarak Ultrasonik</div>
            <div className="chart-subtitle">Jarak sensor dalam cm</div>
          </div>
          <PeriodTabs period={period} onChange={onPeriodChange} />
        </div>
      </div>

      <div style={{ padding: "0 var(--space-2) var(--space-4)" }}>
        {isLoading ? (
          <ChartSkeleton />
        ) : data.length === 0 ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
            Belum ada data untuk periode ini
          </div>
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top: 16, right: 16, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="ultraGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-water)" stopOpacity={0.22} />
                    <stop offset="85%" stopColor="var(--chart-water)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false} tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false} tickMargin={4}
                  width={36}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={labelStyle}
                  formatter={(val: unknown) => [`${val ?? ""} cm`, "Ultrasonik"]}
                  cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="ultrasonic"
                  stroke="var(--chart-water)"
                  strokeWidth={2}
                  fill="url(#ultraGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--bg-surface)", fill: "var(--chart-water)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TEMPERATURE CHART (suhu, °C)
   ══════════════════════════════════════════════════════════ */

export function TemperatureChart({ data, period, onPeriodChange, isLoading }: ChartProps) {
  return (
    <div className="card chart-container" style={{ padding: 0 }}>
      <div style={{ padding: "var(--space-5) var(--space-5) 0" }}>
        <div className="chart-header">
          <div>
            <div className="chart-title">Suhu</div>
            <div className="chart-subtitle">Suhu dalam derajat Celsius</div>
          </div>
          <PeriodTabs period={period} onChange={onPeriodChange} />
        </div>
      </div>

      <div style={{ padding: "0 var(--space-2) var(--space-4)" }}>
        {isLoading ? (
          <ChartSkeleton />
        ) : data.length === 0 ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
            Belum ada data untuk periode ini
          </div>
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top: 16, right: 16, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--status-siaga)" stopOpacity={0.22} />
                    <stop offset="85%" stopColor="var(--status-siaga)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false} tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false} tickMargin={4}
                  width={36}
                  tickFormatter={(v) => `${v}°`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={labelStyle}
                  formatter={(val: unknown) => [`${val ?? ""} °C`, "Suhu"]}
                  cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="temperature"
                  stroke="var(--status-siaga)"
                  strokeWidth={2}
                  fill="url(#tempGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--bg-surface)", fill: "var(--status-siaga)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SOIL MOISTURE CHART
   ══════════════════════════════════════════════════════════ */

export function SoilMoistureChart({ data, period, onPeriodChange, isLoading }: ChartProps) {
  return (
    <div className="card chart-container" style={{ padding: 0 }}>
      <div style={{ padding: "var(--space-5) var(--space-5) 0" }}>
        <div className="chart-header">
          <div>
            <div className="chart-title">Kelembaban Tanah</div>
            <div className="chart-subtitle">Persentase kandungan air dalam tanah</div>
          </div>
          <PeriodTabs period={period} onChange={onPeriodChange} />
        </div>
      </div>

      <div style={{ padding: "0 var(--space-2) var(--space-4)" }}>
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top: 16, right: 16, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="moistGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-moisture)" stopOpacity={0.22} />
                    <stop offset="85%" stopColor="var(--chart-moisture)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false} tickMargin={8}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--chart-axis)", fontFamily: "var(--font-mono)" }}
                  axisLine={false} tickLine={false} tickMargin={4}
                  width={30}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={labelStyle}
                  formatter={(val: unknown) => [`${val ?? ""}%`, "Kelembaban"]}
                  cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                />
                <ReferenceLine
                  y={50}
                  stroke="var(--status-siaga)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.45}
                  strokeWidth={1.5}
                  label={{ value: "min.aman", position: "insideTopRight", fontSize: 9, fill: "var(--status-siaga)", fontFamily: "var(--font-display)", fontWeight: 700 }}
                />
                <Area
                  type="monotone"
                  dataKey="soilMoisture"
                  stroke="var(--chart-moisture)"
                  strokeWidth={2}
                  fill="url(#moistGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--bg-surface)", fill: "var(--chart-moisture)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
