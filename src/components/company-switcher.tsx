"use client";

import { useTransition } from "react";
import { switchCompany } from "@/app/(app)/actions";

type Option = { id: string; name: string };

export function CompanySwitcher({ companies, currentId }: { companies: Option[]; currentId: string | null }) {
  const [pending, start] = useTransition();

  if (companies.length <= 1) {
    return <span className="truncate text-lg font-bold">{companies[0]?.name ?? "No company yet"}</span>;
  }

  return (
    <label className="relative flex min-w-0 items-center">
      <span className="sr-only">Working in company</span>
      <select
        value={currentId ?? ""}
        disabled={pending}
        onChange={(e) => start(() => switchCompany(e.target.value))}
        className="min-h-11 max-w-full appearance-none truncate rounded-lg bg-white/15 py-1 pr-9 pl-3 text-lg font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id} className="text-black">
            {c.name}
          </option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-2 h-5 w-5 fill-white">
        <path d="M5.5 7.5 10 12l4.5-4.5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    </label>
  );
}
