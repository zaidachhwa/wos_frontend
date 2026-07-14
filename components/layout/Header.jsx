"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Moon, Search, Sparkles, Sun } from "lucide-react";

import { NAV_ITEMS } from "@/constants/nav.constants";
import NotificationBell from "@/components/layout/NotificationBell";
import AssistantDrawer from "@/components/layout/AssistantDrawer";
import CommandPalette from "@/components/layout/CommandPalette";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/services/authService";

export default function Header({ onMenuClick }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const title = NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label || "WorkOS";

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // No React state: CSS shows the right icon off data-theme, so SSR and
  // client can't disagree.
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // private mode — theme just won't persist
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // clear the local session regardless of API failure
    }
    clearAuth();
    router.replace("/login");
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1.5 rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary lg:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-4">
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label="Search (Ctrl+K)"
          className="flex items-center gap-2 rounded-btn border border-border px-2 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-background hover:text-primary sm:px-3"
        >
          <Search size={15} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline">⌘K</kbd>
        </button>
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
        >
          <Moon size={18} className="theme-dark-hidden" />
          <Sun size={18} className="theme-dark-only" />
        </button>
        <button
          onClick={() => setAssistantOpen(true)}
          aria-label="Open AI assistant"
          className="rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
        >
          <Sparkles size={18} />
        </button>
        <NotificationBell />
        <div className="hidden text-right md:block">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs capitalize text-muted">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
        >
          <LogOut size={18} />
        </button>
      </div>
      <AssistantDrawer open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}
