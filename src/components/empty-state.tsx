import Link from "next/link";

export function EmptyState({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-text-muted">{body}</p>
      {href && cta && (
        <Link href={href} className="btn btn-primary mt-4">{cta}</Link>
      )}
    </div>
  );
}
