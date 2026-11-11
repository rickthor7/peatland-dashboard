"use client";

import { usePathname } from "next/navigation";
import { Bell, Menu, Clock, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/components/providers/ThemeProvider";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/monitoring": "Monitoring",
  "/alerts": "Alert Center",
};

interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState<string>("");
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const tick = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = () => {
    if (pathname.startsWith("/monitoring/")) return "Node Detail";
    return PAGE_TITLES[pathname] ?? "Peatland Analytics";
  };

  return (
    <header className="app-header" role="banner">
      <div className="header-breadcrumb">
        <button
          className="mobile-menu-btn"
          onClick={onMenuClick}
          aria-label="Buka menu navigasi"
          id="mobile-menu-toggle"
        >
          <Menu size={18} />
        </button>
        <span className="header-page-title">{getPageTitle()}</span>
      </div>

      <div className="header-right">
        {/* Live clock */}
        <div
          className="last-update-badge"
          aria-live="polite"
          aria-label={`Waktu sekarang: ${currentTime}`}
        >
          <span className="live-dot" aria-hidden="true" />
          {currentTime}
        </div>

        {/* Theme toggle */}
        <button
          className="header-theme-btn"
          onClick={toggleTheme}
          aria-label={`Ganti ke mode ${theme === "dark" ? "terang" : "gelap"}`}
          id="theme-toggle-header"
          title={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Alerts link */}
        <Link
          href="/alerts"
          className="header-icon-btn"
          aria-label="Lihat alerts — ada notifikasi baru"
          id="alerts-button"
        >
          <Bell size={16} />
          <span className="notification-badge" aria-hidden="true">2</span>
        </Link>
      </div>
    </header>
  );
}
