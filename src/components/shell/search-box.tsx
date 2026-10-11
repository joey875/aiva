"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { customerName } from "@/lib/types";

type Result = { id: string; name: string; sub: string };

export function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!query) {
        if (!cancelled) setResults([]);
        return;
      }
      const safe = query.replace(/[%,()]/g, " ");
      const supabase = createClient();
      const { data } = await supabase
        .from("customers")
        .select("id, business_name, contact_name, phone, email")
        .or(["business_name", "contact_name", "phone", "email"].map((c) => `${c}.ilike.%${safe}%`).join(","))
        .order("updated_at", { ascending: false })
        .limit(6);
      if (cancelled) return;
      setResults(
        (data ?? []).map((c) => ({
          id: c.id as string,
          name: customerName(c as { business_name: string; contact_name: string }),
          sub: [c.phone, c.email].filter(Boolean).join(" · "),
        })),
      );
      setOpen(true);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = () => {
    const query = q.trim();
    setOpen(false);
    router.push(query ? `/customers?q=${encodeURIComponent(query)}` : "/customers");
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-lg">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
      <label className="sr-only" htmlFor="global-search">Search customers, deals, notes, or ask AIVA</label>
      <input
        id="global-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") go();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search customers, deals, notes, or ask AIVA…"
        className="h-10 w-full rounded-lg border border-white/20 bg-white/15 pl-9 pr-3 text-sm text-white placeholder-white/70 outline-none focus-visible:ring-2 focus-visible:ring-white"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface py-1 text-text shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <Link href={`/customers/${r.id}`} onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-surface-2">
                <p className="truncate font-semibold">{r.name}</p>
                {r.sub && <p className="truncate text-xs text-text-muted">{r.sub}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
