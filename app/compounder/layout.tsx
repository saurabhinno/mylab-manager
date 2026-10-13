"use client";

import RequireRole from "@/components/RequireRole";

export default function CompounderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Doctors may switch into compounder view; compounders stay here only.
  return (
    <RequireRole role={["doctor", "compounder"]}>{children}</RequireRole>
  );
}
