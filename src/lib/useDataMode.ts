"use client";

import { useEffect, useState } from "react";
import { monitoringRepository } from "@/features/monitoring/services/monitoringService";
import type { DataMode } from "@/types/domain";

/**
 * Pantau mode data secara berkala:
 * - "live"  → telemetri asli dari database
 * - "dummy" → koneksi database terputus, data dibuat di browser (tanpa MQTT)
 */
export function useDataMode(intervalMs = 10_000) {
  const [mode, setMode] = useState<DataMode>("live");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const status = await monitoringRepository.getSystemStatus();
        if (!cancelled) {
          setMode(status.dataMode);
          setNote(status.modeNote ?? "");
        }
      } catch {
        // Gagal membaca status → abaikan, tick berikutnya mencoba lagi.
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { mode, note, isDummy: mode === "dummy" };
}
