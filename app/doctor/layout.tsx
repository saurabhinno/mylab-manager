"use client";

import RequireRole from "@/components/RequireRole";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireRole role="doctor">{children}</RequireRole>;
}
