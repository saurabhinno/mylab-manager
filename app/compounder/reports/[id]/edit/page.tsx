"use client";

import { useParams } from "next/navigation";
import ReportEditWizard from "@/components/ReportEditWizard";

export default function CompounderReportEditPage() {
  const params = useParams();
  const id = String(params.id || "");
  return <ReportEditWizard reportId={id} role="compounder" />;
}
