"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { NAV_ITEMS } from "@/constants/nav.constants";
import { useAuthStore } from "@/store/authStore";

// Below lg: fixed off-canvas drawer controlled by mobileOpen/onMobileClose.
// At lg+: normal sticky column, collapse/expand via its own local state.
export default function Sidebar({ mobileOpen = false, onMobileClose }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-70 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:translate-x-0 lg:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : "lg:w-70"}`}
      >
        <div className={`flex h-16 items-center border-b border-border px-4 ${collapsed ? "lg:justify-center" : "justify-between"}`}>
          {(!collapsed || mobileOpen) && <span className="text-lg font-semibold tracking-tight">WorkOS</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary lg:block"
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <button
            onClick={onMobileClose}
            aria-label="Close menu"
            className="rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={`relative flex items-center gap-3 rounded-btn px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  collapsed ? "lg:justify-center" : ""
                } ${
                  active
                    ? "bg-background text-primary"
                    : "text-muted hover:bg-background hover:text-primary"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                )}
                <Icon size={20} className="shrink-0" />
                <span className={collapsed ? "truncate lg:hidden" : "truncate"}>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
