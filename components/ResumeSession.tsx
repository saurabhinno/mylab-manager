"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

/** Send an already-signed-in user to their home. Returns true once it is safe to show sign-in. */
export function useResumeSession() {
  const router = useRouter();
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/auth/me")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((user) => {
        if (cancelled) return;
        if (user?.role === "doctor") {
          router.replace("/doctor/dashboard");
          return;
        }
        if (user?.role === "compounder") {
          router.replace("/compounder/reports");
          return;
        }
        setShowSignIn(true);
      })
      .catch(() => {
        if (!cancelled) setShowSignIn(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return showSignIn;
}
