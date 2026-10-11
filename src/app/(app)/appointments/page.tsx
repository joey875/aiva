import { CalendarClock } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Appointments" };

export default function AppointmentsPage() {
  return (
    <ComingSoon
      icon={<CalendarClock className="h-7 w-7" />}
      title="Appointments"
      description="A full appointment calendar and booking flow is coming soon."
    />
  );
}
