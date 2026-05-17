"use client";
import { useProjects } from "@/lib/hooks";
import Link from "next/link";

export default function ProjectsPage() {
  const { data, isLoading } = useProjects();
  const projects = data?.workspace?.projects?.edges?.map((e: any) => e.node) || [];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Projects</h1>
      {isLoading ? <p style={{ color: "#64748b" }}>Loading...</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {projects.map((p: any) => (
            <Link key={p.id} href={`/dashboard/project/${p.id}`}>
              <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 12, padding: 20, cursor: "pointer", transition: "0.15s" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, fontFamily: "monospace" }}>{p.id.slice(0, 20)}...</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {p.services.edges.map((s: any) => (
                    <span key={s.node.id} style={{ background: "#2d3548", color: "#94a3b8", fontSize: 11, padding: "3px 8px", borderRadius: 4 }}>{s.node.name}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 10 }}>Created {new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
