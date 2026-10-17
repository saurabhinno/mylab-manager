"use client";

import RequireRole from "@/components/RequireRole";
import AnalyzerLanBridge from "@/components/AnalyzerLanBridge";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole role="doctor">
      <AnalyzerLanBridge />
      {children}
    </RequireRole>
  );
}
