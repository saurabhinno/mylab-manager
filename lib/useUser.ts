"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";

interface UserInfo {
  id: number;
  email: string;
  name: string | null;
  role: "doctor" | "compounder";
}

export function useUser() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && !d.error) setUser(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { user, loading };
}
