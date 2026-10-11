"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Home,
  KanbanSquare,
  LogOut,
  Mic,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { switchCompany } from "@/app/(app)/actions";
import { initials } from "@/lib/types";

type MenuItem = { href: string; label: string; Icon: typeof Home; badge?: number };
type CompanyItem = { id: string; name: string; brand_color: string | null };

export function Sidebar({
  companies,
  currentId,
  admin,
  taskBadge,
  mobileOpen,
  onClose,
}: {
  companies: CompanyItem[];
  currentId: string | null;
  admin: boolean;
  taskBadge: number;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const content = (
    <SidebarContent companies={companies} currentId={currentId} admin={admin} taskBadge={taskBadge} onNavigate={onClose} />
  );

  return (
    <>
      <nav
        aria-label="Main"
        className="hidden md:sticky md:top-14 md:z-20 md:flex md:h-[calc(100dvh-3.5rem)] md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:border-r md:border-border md:bg-surface"
      >
        {content}
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-black/40" />
          <nav aria-label="Main" className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-surface pt-[env(safe-area-inset-top)] shadow-xl">
            {content}
          </nav>
        </div>
      )}
    </>
  );
}

function SidebarContent({
  companies,
  currentId,
  admin,
  taskBadge,
  onNavigate,
}: {
  companies: CompanyItem[];
  currentId: string | null;
  admin: boolean;
  taskBadge: number;
  onNavigate: () => void;
}) {
  const path = usePathname();
  const [pending, start] = useTransition();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const MENU: MenuItem[] = [
    { href: "/", label: "Today", Icon: Home },
    { href: "/customers", label: "Customers", Icon: Users },
    { href: "/pipeline", label: "Pipeline", Icon: KanbanSquare },
    { href: "/appointments", label: "Appointments", Icon: CalendarClock },
    { href: "/tasks", label: "Tasks", Icon: CheckSquare, badge: taskBadge },
    { href: "/calendar", label: "Calendar", Icon: CalendarDays },
    { href: "/assistant", label: "AIVA Assistant", Icon: Mic },
    { href: "/reports", label: "Reports", Icon: BarChart3 },
  ];
  if (admin) MENU.push({ href: "/admin", label: "Admin", Icon: ShieldCheck });

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 space-y-0.5 p-3">
        {MENU.map(({ href, label, Icon, badge }) => {
          const on = active(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-semibold ${
                  on ? "bg-primary/10 text-primary" : "text-text hover:bg-surface-2"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {!!badge && (
                  <span className="rounded-full bg-danger px-1.5 py-0.5 text-xs font-bold text-white">{badge}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {companies.length > 0 && (
        <div className="border-t border-border p-3">
          <p className="mb-1.5 px-3 text-xs font-bold tracking-wide text-text-muted uppercase">Companies</p>
          <ul className="space-y-0.5">
            {companies.map((c) => {
              const on = c.id === currentId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      start(() => switchCompany(c.id));
                      onNavigate();
                    }}
                    className={`flex min-h-10 w-full items-center gap-3 rounded-full px-3 text-left text-sm font-semibold ${
                      on ? "bg-primary/10 text-primary" : "text-text hover:bg-surface-2"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: c.brand_color || "var(--primary)" }}
                    >
                      {initials(c.name)}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                  </button>
                </li>
              );
            })}
            {admin && (
              <li>
                <Link
                  href="/admin/companies"
                  onClick={onNavigate}
                  className="flex min-h-10 items-center gap-3 rounded-full px-3 text-sm font-semibold text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[11px]">
                    +
                  </span>
                  All Companies
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="space-y-0.5 border-t border-border p-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-semibold text-text hover:bg-surface-2"
        >
          <SettingsIcon className="h-5 w-5" />
          Settings
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm font-semibold text-text hover:bg-surface-2">
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
