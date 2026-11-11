"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Activity, Bell, Leaf, Wifi, Sun, Moon,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useDataMode } from "@/lib/useDataMode";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { isDummy, note } = useDataMode();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Brand + toggle collapse */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon" aria-hidden="true">
          <Leaf size={16} color="white" strokeWidth={2.5} />
        </div>
        <div className="sidebar-brand-copy">
          <div className="sidebar-brand-text">Peatland</div>
          <div className="sidebar-brand-sub">IoT Analytics System</div>
        </div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Perluas sidebar" : "Ringkas sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Perluas sidebar" : "Ringkas sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                size={18}
                className="sidebar-nav-icon"
                aria-hidden="true"
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="sidebar-nav-label">{item.label}</span>
              <span className="sidebar-nav-tooltip" aria-hidden="true">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Connection indicator */}
        <div
          className="connection-indicator"
          title={isDummy ? `Mode dummy aktif — ${note || "database tidak terhubung"}` : "Status koneksi sistem"}
        >
          <span
            className={`connection-dot ${isDummy ? "dummy" : "online"}`}
            role="status"
            aria-label={
              isDummy
                ? "Koneksi database terputus, mode simulasi aktif"
                : "Status koneksi sistem: terhubung"
            }
          />
          <Wifi size={12} aria-hidden="true" />
          <span className="sidebar-nav-label">
            {isDummy ? "Mode Simulasi" : "System connected"}
          </span>
        </div>

        {/* Theme toggle */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Mode ${theme === "dark" ? "gelap aktif — klik untuk mode terang" : "terang aktif — klik untuk mode gelap"}`}
          id="theme-toggle-sidebar"
          title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
        >
          {theme === "dark" ? (
            <><Sun size={14} aria-hidden="true" /> <span className="sidebar-nav-label">Mode Terang</span></>
          ) : (
            <><Moon size={14} aria-hidden="true" /> <span className="sidebar-nav-label">Mode Gelap</span></>
          )}
          <div className="theme-toggle-track" aria-hidden="true">
            <div className="theme-toggle-thumb" />
          </div>
        </button>
      </div>
    </>
  );
}
