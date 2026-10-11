"use client";

import Link from "next/link";
import { Bell, HelpCircle, LogOut, Menu, MapPin } from "lucide-react";
import { SearchBox } from "./search-box";
import { initials } from "@/lib/types";

export function TopBar({
  companyName,
  fullName,
  email,
  roleLabel,
  dueCount,
  onMenuClick,
}: {
  companyName: string | null;
  fullName: string;
  email: string;
  roleLabel: string;
  dueCount: number;
  onMenuClick: () => void;
}) {
  const displayName = fullName || email;

  return (
    <header
      className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] text-white"
      style={{ background: "linear-gradient(90deg, var(--primary-hover), var(--primary))" }}
    >
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 md:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 md:w-52">
          <MapPin aria-hidden className="h-4 w-4 shrink-0 text-white/80" />
          <span className="truncate text-base font-bold">{companyName ?? "No company"}</span>
        </div>

        <div className="hidden flex-1 justify-center sm:flex">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/tasks"
            aria-label={`Reminders due, ${dueCount}`}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/15"
          >
            <Bell className="h-5 w-5" />
            {dueCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {dueCount > 99 ? "99+" : dueCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            title="Help coming soon"
            aria-label="Help"
            onClick={(e) => e.preventDefault()}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/15"
          >
            <HelpCircle className="h-5 w-5" />
          </button>

          <details className="relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-1.5 hover:bg-white/15">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {initials(displayName)}
              </span>
              <span className="hidden text-left leading-tight lg:block">
                <span className="block truncate text-sm font-semibold">{displayName}</span>
                <span className="block text-xs text-white/75">{roleLabel}</span>
              </span>
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-border bg-surface p-2 text-text shadow-lg">
              <p className="truncate px-2 py-1 font-semibold">{displayName}</p>
              <p className="px-2 pb-2 text-sm text-text-muted">{roleLabel}</p>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold hover:bg-surface-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>

      <div className="px-3 pb-2 sm:hidden">
        <SearchBox />
      </div>
    </header>
  );
}
