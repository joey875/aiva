import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-sm flex-col justify-center px-5">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-ink-soft">This page doesn&apos;t exist, or it belongs to someone else&apos;s pipeline.</p>
      <Link href="/" className="btn btn-primary mt-5">Go to Today</Link>
    </main>
  );
}
