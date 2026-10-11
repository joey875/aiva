import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <ComingSoon
      icon={<BarChart3 className="h-7 w-7" />}
      title="Reports"
      description="Pipeline and activity reports are coming soon."
    />
  );
}
