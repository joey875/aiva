import { Mic } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "AIVA Assistant" };

export default function AssistantPage() {
  return (
    <ComingSoon
      icon={<Mic className="h-7 w-7" />}
      title="AIVA Assistant"
      description="A full assistant workspace is coming soon - for now, hold the mic button anywhere to talk to Aiva."
    />
  );
}
