"use client";

import RequireRole from "@/components/RequireRole";
import AnalyzerLanBridge from "@/components/AnalyzerLanBridge";

export default function CompounderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Doctors may switch into compounder view; compounders stay here only.
  return (
    <RequireRole role={["doctor", "compounder"]}>
      <AnalyzerLanBridge />
      {children}
    </RequireRole>
  );
}
