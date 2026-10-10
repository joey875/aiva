"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveStage } from "@/app/(app)/customers/actions";

export type Card = {
  id: string;
  name: string;
  stageId: string | null;
  owner: string | null;
  nextStep: string | null;
  overdue: boolean;
};

type Stage = { id: string; name: string };

export function PipelineBoard({ stages, cards }: { stages: Stage[]; cards: Card[] }) {
  const [, start] = useTransition();
  const [optimistic, applyMove] = useOptimistic(cards, (state, move: { id: string; stageId: string }) =>
    state.map((c) => (c.id === move.id ? { ...c, stageId: move.stageId } : c)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const move = (id: string, stageId: string) => {
    start(async () => {
      applyMove({ id, stageId });
      await moveStage(id, stageId);
    });
  };

  return (
    // Columns scroll sideways on phones; drag on desktop, or use each card's stage menu anywhere.
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:snap-none">
      {stages.map((stage) => {
        const list = optimistic.filter((c) => c.stageId === stage.id);
        return (
          <section
            key={stage.id}
            aria-label={`${stage.name}, ${list.length} customers`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage.id);
            }}
            onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              setOverStage(null);
              setDragId(null);
              if (id) move(id, stage.id);
            }}
            className={`flex w-[82vw] max-w-72 shrink-0 snap-start flex-col rounded-xl bg-surface-2 p-2 sm:w-72 ${overStage === stage.id ? "ring-2 ring-ava" : ""}`}
          >
            <h2 className="flex items-center justify-between px-2 py-1.5 font-bold">
              {stage.name}
              <span className="text-sm font-semibold text-ink-soft">{list.length}</span>
            </h2>
            <ul className="flex min-h-24 flex-col gap-2">
              {list.map((card) => (
                <li
                  key={card.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", card.id);
                    setDragId(card.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={`rounded-lg bg-surface p-3 shadow-[inset_0_0_0_1px_var(--line)] ${dragId === card.id ? "opacity-50" : ""}`}
                >
                  <Link href={`/customers/${card.id}`} className="block font-semibold hover:underline">
                    {card.name}
                  </Link>
                  {card.owner && <p className="text-sm text-ink-soft">{card.owner}</p>}
                  {card.nextStep && (
                    <p className={`mt-1 text-sm ${card.overdue ? "font-semibold text-attention" : "text-ink-soft"}`}>
                      {card.overdue ? "Overdue: " : ""}
                      {card.nextStep}
                    </p>
                  )}
                  <label className="mt-2 block">
                    <span className="sr-only">Move {card.name} to stage</span>
                    <select
                      value={card.stageId ?? ""}
                      onChange={(e) => move(card.id, e.target.value)}
                      className="min-h-10 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink-soft"
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>{s.id === card.stageId ? `In ${s.name}` : `Move to ${s.name}`}</option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
