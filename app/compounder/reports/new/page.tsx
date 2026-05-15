"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect to reports page — sample collection is now a dialog there
export default function NewReportRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/compounder/reports"); }, [router]);
  return null;
}
