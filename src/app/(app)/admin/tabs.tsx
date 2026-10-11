"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/reps", label: "Salespeople" },
  { href: "/admin/companies", label: "Companies" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const on = path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px min-h-11 border-b-2 px-3 py-2.5 font-semibold ${on ? "border-primary text-text" : "border-transparent text-text-muted hover:text-text"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
