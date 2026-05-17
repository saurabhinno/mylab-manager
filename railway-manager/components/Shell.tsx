"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { gql, getToken, clearToken } from "@/lib/railway";

const nav = [
  { label: "Projects", href: "/dashboard", icon: "📦" },
  { label: "Usage", href: "/dashboard/usage", icon: "📊" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = getToken();

  const { data: userData, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => gql(token!, `query { me { name email } }`),
    enabled: !!token,
    staleTime: 5 * 60_000, // cache user for 5 min
  });

  useEffect(() => {
    if (!token || isError) { clearToken(); router.replace("/login"); }
  }, [token, isError, router]);

  const user = userData?.me;

  function logout() { clearToken(); router.replace("/login"); }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: "#13161f", borderRight: "1px solid #1e2330", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 10 }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #1e2330" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🚀</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Railway Manager</span>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <a key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, marginBottom: 2,
                background: active ? "#7c3aed20" : "transparent", color: active ? "#a78bfa" : "#94a3b8",
                fontSize: 13, fontWeight: active ? 600 : 400, transition: "0.15s",
              }}>
                <span>{item.icon}</span>{item.label}
              </a>
            );
          })}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e2330" }}>
          {user && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{user.email}</div>
            </div>
          )}
          <button onClick={logout} style={{ background: "none", border: "none", color: "#f87171", fontSize: 12, cursor: "pointer", padding: 0 }}>Logout</button>
        </div>
      </aside>
      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: 24, minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
