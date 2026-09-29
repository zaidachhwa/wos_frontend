"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuthStore } from "@/store/authStore";
import { HR_ROLES, VIEW_ALL_ROLES } from "@/lib/appraisal";

const TABS = [
  { href: "/appraisal", label: "Dashboard", roles: VIEW_ALL_ROLES, exact: true },
  { href: "/appraisal/inputs", label: "Monthly inputs", roles: HR_ROLES },
  { href: "/bugs", label: "Bugs", roles: VIEW_ALL_ROLES },
  { href: "/appraisal/reports", label: "Reports", roles: VIEW_ALL_ROLES },
  { href: "/appraisal/emails", label: "Email log", roles: HR_ROLES },
  { href: "/appraisal/settings", label: "Settings", roles: HR_ROLES },
];

// Sub-navigation shared by every HR appraisal screen.
export default function AppraisalTabs() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const tabs = TABS.filter((t) => t.roles.includes(role));
  if (tabs.length < 2) return null;

  return (
    <nav aria-label="Appraisal sections" className="flex flex-wrap gap-1 self-start rounded-btn border border-border bg-surface p-1">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              active ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
