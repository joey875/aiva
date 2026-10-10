"use client";

import { useTransition } from "react";
import { moveStage } from "@/app/(app)/customers/actions";

export function StageSelect({
  customerId,
  stageId,
  stages,
  compact = false,
}: {
  customerId: string;
  stageId: string | null;
  stages: { id: string; name: string }[];
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <label className="block">
      <span className={compact ? "sr-only" : "label"}>Pipeline stage</span>
      <select
        value={stageId ?? ""}
        disabled={pending}
        onChange={(e) => start(() => moveStage(customerId, e.target.value))}
        className={compact ? "min-h-10 w-full rounded-md border border-line bg-surface px-2 text-sm" : "field"}
      >
        {!stageId && <option value="">No stage</option>}
        {stages.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  );
}
