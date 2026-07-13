"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { NAV_ITEMS } from "@/constants/nav.constants";
import { useAuthStore } from "@/store/authStore";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out ${
        collapsed ? "w-20" : "w-70"
      }`}
    >
      <div className={`flex h-16 items-center border-b border-border px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && <span className="text-lg font-semibold tracking-tight">WorkOS</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`relative flex items-center gap-3 rounded-btn px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                collapsed ? "justify-center" : ""
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
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
