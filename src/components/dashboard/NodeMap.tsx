"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Radio, Wifi, WifiOff, Layers } from "lucide-react";
import type { MonitoringNode, MonitoringReading, RiskStatus } from "@/types/domain";
import { StatusBadge } from "@/components/status/StatusBadge";
import { formatRelativeTime, formatTimestamp } from "@/lib/constants";
import "leaflet/dist/leaflet.css";

interface NodeMapProps {
  nodes: MonitoringNode[];
  readings: MonitoringReading[];
}

const STATUS_COLORS: Record<RiskStatus, string> = {
  AMAN: "#22c55e",
  SIAGA: "#eab308",
  AWAS: "#ef4444",
};
const NO_DATA_COLOR = "#64748b";

// Node yang datanya berasal dari Supabase (lihat LIVE_NODES di monitoringService)
const LIVE_NODE_IDS = new Set(["NODE-001", "NODE-004"]);

// Fallback pusat peta: lahan gambut Sebangau, Palangka Raya, Kalimantan Tengah
const DEFAULT_CENTER: [number, number] = [-2.3175, 113.9045];
const FOCUS_ZOOM = 17;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletAny = any;

function markerHtml(node: MonitoringNode, color: string, selected: boolean) {
  return `
    <div class="node-marker${selected ? " is-selected" : ""}" style="--c:${color}">
      <span class="node-marker__ring"></span>
      <span class="node-marker__core"><span class="node-marker__dot"></span></span>
      <span class="node-marker__label">${node.name}</span>
    </div>`;
}

function popupHtml(node: MonitoringNode, reading: MonitoringReading | undefined) {
  const isLive = LIVE_NODE_IDS.has(node.id);
  const online = node.connectionStatus === "ONLINE";
  const sourceBadge = isLive
    ? `<span class="node-popup__src is-live"><i></i>LIVE · Supabase</span>`
    : `<span class="node-popup__src"><i></i>Simulasi</span>`;

  if (!reading) {
    return `
      <div class="node-popup">
        <div class="node-popup__head">
          <div><div class="node-popup__title">${node.name}</div><div class="node-popup__sub">${node.id}</div></div>
          ${sourceBadge}
        </div>
        <div class="node-popup__empty">Menunggu data pertama dari node ini…</div>
      </div>`;
  }

  const status = reading.riskIndex.status;
  const color = STATUS_COLORS[status];
  const prev = reading.riskIndex.previousValue;
  const delta = prev === undefined ? null : reading.riskIndex.value - prev;
  const deltaHtml =
    delta === null || delta === 0
      ? ""
      : `<span class="node-popup__delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}</span>`;

  return `
    <div class="node-popup" style="--c:${color}">
      <div class="node-popup__head">
        <div>
          <div class="node-popup__title">${node.name}</div>
          <div class="node-popup__sub">${node.id} · ${node.blockName ?? "Kalimantan"}</div>
        </div>
        <span class="node-popup__status">${status}</span>
      </div>
      <div class="node-popup__grid" data-key="${reading.id}">
        <div class="node-popup__metric is-risk">
          <span>Indeks Risiko (IKG)</span>
          <b>${reading.riskIndex.value}${deltaHtml}</b>
        </div>
        <div class="node-popup__metric">
          <span>TMA</span>
          <b>${reading.waterLevel.value}<small> ${reading.waterLevel.unit}</small></b>
        </div>
        <div class="node-popup__metric">
          <span>Kelembaban</span>
          <b>${reading.soilMoisture.value}<small> ${reading.soilMoisture.unit}</small></b>
        </div>
        <div class="node-popup__metric">
          <span>Koneksi</span>
          <b class="node-popup__conn ${online ? "on" : "off"}">${online ? "Online" : node.connectionStatus === "OFFLINE" ? "Offline" : "—"}</b>
        </div>
      </div>
      <div class="node-popup__foot">
        ${sourceBadge}
        <span>Diterima ${formatTimestamp(reading.recordedAt)} · ${formatRelativeTime(reading.recordedAt)}</span>
      </div>
      <a class="node-popup__link" href="/monitoring/${node.id}">Lihat detail node →</a>
    </div>`;
}

export function NodeMap({ nodes, readings }: NodeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletAny>(null);
  const leafletRef = useRef<LeafletAny>(null);
  // Marker dibuat sekali per node lalu di-update in-place, agar popup yang terbuka tidak tertutup saat polling.
  const markersRef = useRef<Map<string, { marker: LeafletAny; iconKey: string; readingId?: string }>>(new Map());

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id ?? null);

  // Ref ke props/state terbaru untuk dipakai di callback Leaflet (hindari stale closure)
  const nodesRef = useRef(nodes);
  const readingsRef = useRef(readings);
  const selectedRef = useRef(selectedNodeId);

  const getReading = (nodeId: string) => readings.find((r) => r.nodeId === nodeId);

  function syncMarkers() {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    const seen = new Set<string>();
    for (const node of nodesRef.current) {
      const lat = node.location?.latitude;
      const lng = node.location?.longitude;
      if (lat === undefined || lng === undefined) continue;
      seen.add(node.id);

      const reading = readingsRef.current.find((r) => r.nodeId === node.id);
      const color = reading ? STATUS_COLORS[reading.riskIndex.status] : NO_DATA_COLOR;
      const selected = node.id === selectedRef.current;
      const iconKey = `${color}|${selected}|${node.name}`;
      const icon = () =>
        L.divIcon({
          className: "custom-map-marker",
          html: markerHtml(node, color, selected),
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -14],
        });

      let entry = markersRef.current.get(node.id);
      if (!entry) {
        const marker = L.marker([lat, lng], { icon: icon(), riseOnHover: true }).addTo(map);
        marker.bindPopup(popupHtml(node, reading), {
          className: "node-popup-wrap",
          maxWidth: 300,
          minWidth: 260,
          closeButton: true,
          autoPanPadding: [24, 24],
        });
        marker.on("click", () => {
          setSelectedNodeId(node.id);
          map.flyTo([lat, lng], Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.6 });
        });
        entry = { marker, iconKey, readingId: reading?.id };
        markersRef.current.set(node.id, entry);
        continue;
      }

      entry.marker.setLatLng([lat, lng]);
      if (entry.iconKey !== iconKey) {
        entry.marker.setIcon(icon());
        entry.iconKey = iconKey;
      }
      // Hanya render ulang popup bila ada pembacaan baru (memicu animasi "flash" di nilai)
      if (entry.readingId !== reading?.id) {
        entry.marker.setPopupContent(popupHtml(node, reading));
        entry.readingId = reading?.id;
      }
    }

    // Hapus marker node yang sudah tidak ada
    markersRef.current.forEach((entry, id) => {
      if (!seen.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    });
  }

  // Inisialisasi peta Leaflet sekali di sisi client
  useEffect(() => {
    let isCancelled = false;
    const markers = markersRef.current;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;
      if (isCancelled || !mapContainerRef.current) return;
      leafletRef.current = L;

      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 15,
        scrollWheelZoom: false,
      });

      // Basemap gratis: OpenStreetMap (default) + citra satelit Esri sebagai opsi
      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 }
      );
      L.control.layers({ OpenStreetMap: osm, Satelit: satellite }, undefined, { position: "topright" }).addTo(map);
      L.control.scale({ imperial: false }).addTo(map);

      mapInstanceRef.current = map;
      syncMarkers();

      // Zoom otomatis agar semua node (yang berdekatan) terlihat
      const points = nodesRef.current
        .filter((n) => n.location?.latitude !== undefined && n.location?.longitude !== undefined)
        .map((n) => [n.location!.latitude!, n.location!.longitude!] as [number, number]);
      if (points.length > 1) map.fitBounds(points, { padding: [60, 60], maxZoom: 17 });
      else if (points.length === 1) map.setView(points[0], FOCUS_ZOOM);
    }

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markers.clear();
    };
  }, []);

  // Sinkronkan marker & popup setiap ada data baru (polling) atau node terpilih berubah
  useEffect(() => {
    nodesRef.current = nodes;
    readingsRef.current = readings;
    selectedRef.current = selectedNodeId;
    syncMarkers();
  }, [nodes, readings, selectedNodeId]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];
  const selectedReading = selectedNode ? getReading(selectedNode.id) : null;
  const isSelectedLive = selectedNode ? LIVE_NODE_IDS.has(selectedNode.id) : false;

  const handleSelectNode = (node: MonitoringNode) => {
    setSelectedNodeId(node.id);
    const lat = node.location?.latitude;
    const lng = node.location?.longitude;
    const map = mapInstanceRef.current;
    if (lat !== undefined && lng !== undefined && map) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.6 });
      markersRef.current.get(node.id)?.marker.openPopup();
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "8px",
              background: "rgba(34, 197, 94, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent, #22c55e)",
            }}
          >
            <MapPin size={18} />
          </div>
          <div>
            <h2 className="text-section-title" style={{ margin: 0, fontSize: "1rem" }}>
              Peta Sebaran Node Pemantauan (Sebangau, Kalimantan Tengah)
            </h2>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              OpenStreetMap · klik titik node untuk melihat telemetri real-time yang dikirim node
            </p>
          </div>
        </div>

        {/* Tab Pemilihan Node Cepat */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {nodes.map((node) => {
            const reading = getReading(node.id);
            const status = reading?.riskIndex.status;
            const isSelected = node.id === selectedNodeId;
            return (
              <button
                key={node.id}
                id={`map-node-tab-${node.id}`}
                type="button"
                onClick={() => handleSelectNode(node)}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  border: isSelected ? "1px solid var(--accent, #22c55e)" : "1px solid var(--border-subtle)",
                  background: isSelected ? "rgba(34, 197, 94, 0.15)" : "var(--bg-elevated)",
                  color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: status ? STATUS_COLORS[status] : NO_DATA_COLOR,
                  }}
                />
                {node.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Map & Detail Panel */}
      <div className="map-layout-grid">
        {/* Kontainer Peta OSM */}
        <div style={{ position: "relative", minHeight: 420, width: "100%", background: "var(--bg-elevated)" }}>
          <div id="node-map" ref={mapContainerRef} style={{ width: "100%", height: "100%", minHeight: 420 }} />
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              zIndex: 1000,
              background: "rgba(10, 15, 10, 0.85)",
              backdropFilter: "blur(6px)",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: "0.7rem",
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              pointerEvents: "none",
            }}
          >
            <Layers size={12} /> Klik titik node untuk melihat data real-time
          </div>
        </div>

        {/* Panel Telemetri Node yang Dipilih */}
        <div
          style={{
            borderLeft: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "var(--space-4)",
          }}
        >
          {selectedNode ? (
            <>
              <div>
                {/* Header Node */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {selectedNode.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {selectedNode.blockName ?? "Kalimantan Tengah"}
                    </div>
                    <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
                      ID: {selectedNode.id}
                    </div>
                  </div>
                  {selectedReading && <StatusBadge status={selectedReading.riskIndex.status} />}
                </div>

                {/* Badge Sumber Data */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: isSelectedLive ? "rgba(34, 197, 94, 0.15)" : "var(--bg-elevated)",
                    color: isSelectedLive ? "#4ade80" : "var(--text-secondary)",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    marginBottom: "14px",
                  }}
                >
                  <Radio size={11} className="pulse-live" />
                  {isSelectedLive ? "Live Data dari Supabase" : "Data Simulasi (dummy)"}
                </div>

                {/* Indikator Telemetri Terbaru */}
                {selectedReading ? (
                  <div
                    key={selectedReading.id}
                    className="map-telemetry-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "14px",
                    }}
                  >
                    <div className="map-telemetry-tile">
                      <div className="map-telemetry-tile__label">Indeks Risiko (IKG)</div>
                      <div
                        className="map-telemetry-tile__value"
                        style={{ color: STATUS_COLORS[selectedReading.riskIndex.status] }}
                      >
                        {selectedReading.riskIndex.value}
                      </div>
                    </div>

                    <div className="map-telemetry-tile">
                      <div className="map-telemetry-tile__label">TMA</div>
                      <div className="map-telemetry-tile__value">
                        {selectedReading.waterLevel.value}{" "}
                        <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>{selectedReading.waterLevel.unit}</span>
                      </div>
                    </div>

                    <div className="map-telemetry-tile">
                      <div className="map-telemetry-tile__label">Kelembaban</div>
                      <div className="map-telemetry-tile__value">
                        {selectedReading.soilMoisture.value}{" "}
                        <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>{selectedReading.soilMoisture.unit}</span>
                      </div>
                    </div>

                    <div className="map-telemetry-tile">
                      <div className="map-telemetry-tile__label">Koneksi</div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          color: selectedNode.connectionStatus === "ONLINE" ? "var(--status-aman)" : "var(--status-awas)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "4px",
                        }}
                      >
                        {selectedNode.connectionStatus === "ONLINE" ? (
                          <>
                            <Wifi size={13} /> Online
                          </>
                        ) : (
                          <>
                            <WifiOff size={13} /> Offline
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "16px 0", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
                    Belum ada pembacaan telemetri untuk node ini.
                  </div>
                )}

                {/* Lokasi Koordinat */}
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    background: "var(--bg-elevated)",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <MapPin size={12} style={{ color: "var(--accent)" }} />
                    <span style={{ fontFamily: "var(--font-mono)" }}>
                      {selectedNode.location?.latitude?.toFixed(4)}, {selectedNode.location?.longitude?.toFixed(4)}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    Data terakhir diterima:{" "}
                    {selectedReading
                      ? `${formatTimestamp(selectedReading.recordedAt)} (${formatRelativeTime(selectedReading.recordedAt)})`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <Link
                href={`/monitoring/${selectedNode.id}`}
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  width: "100%",
                  textDecoration: "none",
                  fontSize: "0.8125rem",
                  padding: "9px 12px",
                }}
              >
                Lihat Detail Lengkap Node <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center", padding: "30px 0" }}>
              Pilih node di peta
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
