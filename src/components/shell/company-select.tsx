"use client";

import { useTransition } from "react";
import { switchCompany } from "@/app/(app)/actions";

type Option = { id: string; name: string };

export function CompanySelect({ companies, currentId }: { companies: Option[]; currentId: string | null }) {
  const [pending, start] = useTransition();
  if (companies.length <= 1) return null;

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Working in company</span>
      <select
        value={currentId ?? ""}
        disabled={pending}
        onChange={(e) => start(() => switchCompany(e.target.value))}
        className="min-h-10 appearance-none rounded-lg border border-border bg-surface py-1.5 pr-8 pl-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-2 h-4 w-4">
        <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    </label>
  );
}
