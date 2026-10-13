"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { useUser } from "@/lib/useUser";

type Role = "doctor" | "compounder";

/**
 * Restricts a page/section to one or more roles.
 * - Doctor pages: role="doctor" (compounders redirected away)
 * - Compounder pages: role={["doctor","compounder"]} so doctors can still switch view
 */
export default function RequireRole({
  role,
  children,
}: {
  role: Role | Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const router = useRouter();
  const allowed = Array.isArray(role) ? role : [role];
  const allowedKey = allowed.join(",");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed.includes(user.role)) {
      router.replace(
        user.role === "doctor" ? "/doctor/dashboard" : "/compounder/reports"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, allowedKey, router]);

  if (loading || !user || !allowed.includes(user.role)) {
    return (
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  return <>{children}</>;
}
