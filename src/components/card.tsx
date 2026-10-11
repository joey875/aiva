import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6 ${className}`}>{children}</div>
  );
}

export function CardHeader({
  icon,
  title,
  viewAllHref,
}: {
  icon?: ReactNode;
  title: string;
  viewAllHref?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {icon}
        {title}
      </h2>
      {viewAllHref && (
        <Link href={viewAllHref} className="text-sm font-semibold text-primary hover:underline">
          View all
        </Link>
      )}
    </div>
  );
}
