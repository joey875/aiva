import type { ReactNode } from "react";

export function ComingSoon({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-1 max-w-sm text-text-muted">{description}</p>
    </div>
  );
}
