import { Settings as SettingsIcon } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={<SettingsIcon className="h-7 w-7" />}
      title="Settings"
      description="Account and notification settings are coming soon."
    />
  );
}
