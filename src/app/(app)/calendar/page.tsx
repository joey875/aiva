import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <ComingSoon
      icon={<CalendarDays className="h-7 w-7" />}
      title="Calendar"
      description="A combined calendar view of appointments and reminders is coming soon."
    />
  );
}
