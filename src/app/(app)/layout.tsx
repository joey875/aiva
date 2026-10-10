import { getCompanyContext } from "@/lib/companies";
import { isAdmin } from "@/lib/types";
import { CompanySwitcher } from "@/components/company-switcher";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile, companies, current } = await getCompanyContext();
  const brand = current?.brand_color || "#0e7c7b";

  return (
    <div style={{ ["--brand" as string]: brand }} className="min-h-dvh">
      {/* The band carries the current company's color so reps always know which pipeline they're in */}
      <header className="sticky top-0 z-20 bg-brand pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
          <div className="min-w-0 flex-1">
            <CompanySwitcher companies={companies.map((c) => ({ id: c.id, name: c.name }))} currentId={current?.id ?? null} />
          </div>
          <Nav admin={isAdmin(profile)} variant="top" />
          <form action="/auth/signout" method="post">
            <button className="min-h-11 rounded-lg px-3 text-sm font-semibold text-white/85 hover:text-white">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-28 md:pb-12">{children}</main>
      <Nav admin={isAdmin(profile)} variant="bar" />
    </div>
  );
}
