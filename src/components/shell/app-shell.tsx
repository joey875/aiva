"use client";

import { useState, type ReactNode } from "react";
import { AivaVoice } from "@/components/aiva-voice";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";

type CompanyItem = { id: string; name: string; brand_color: string | null };

export function AppShell({
  companyName,
  companies,
  currentId,
  admin,
  fullName,
  email,
  roleLabel,
  taskBadge,
  dueCount,
  children,
}: {
  companyName: string | null;
  companies: CompanyItem[];
  currentId: string | null;
  admin: boolean;
  fullName: string;
  email: string;
  roleLabel: string;
  taskBadge: number;
  dueCount: number;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      <TopBar
        companyName={companyName}
        fullName={fullName}
        email={email}
        roleLabel={roleLabel}
        dueCount={dueCount}
        onMenuClick={() => setMobileOpen(true)}
      />
      <div className="flex">
        <Sidebar companies={companies} currentId={currentId} admin={admin} taskBadge={taskBadge} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 md:pb-10">{children}</main>
      </div>
      <AivaVoice />
    </div>
  );
}
