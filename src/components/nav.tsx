"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode };

const icon = (d: string) => (
  <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ITEMS: Item[] = [
  { href: "/", label: "Today", icon: icon("M4 11h16M8 3v4M16 3v4M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z") },
  { href: "/customers", label: "Customers", icon: icon("M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.75") },
  { href: "/pipeline", label: "Pipeline", icon: icon("M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z") },
];
const ADMIN: Item = { href: "/admin", label: "Admin", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z") };

export function Nav({ admin, variant }: { admin: boolean; variant: "bar" | "top" }) {
  const path = usePathname();
  const items = admin ? [...ITEMS, ADMIN] : ITEMS;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  if (variant === "top") {
    return (
      <nav aria-label="Main" className="hidden gap-1 md:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active(i.href) ? "page" : undefined}
            className={`rounded-lg px-3 py-2 font-semibold text-white/80 hover:text-white ${active(i.href) ? "bg-white/15 text-white" : ""}`}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {items.map((i) => (
          <li key={i.href} className="flex-1">
            <Link
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active(i.href) ? "text-ava" : "text-ink-soft"}`}
            >
              {i.icon}
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
