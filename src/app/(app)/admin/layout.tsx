import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "./tabs";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold tracking-tight">Admin</h1>
      <AdminTabs />
      <div className="mt-5">{children}</div>
    </div>
  );
}
