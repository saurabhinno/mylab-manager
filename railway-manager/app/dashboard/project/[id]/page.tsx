"use client";
import { useParams } from "next/navigation";
import { useProject, useWorkspaces, useProjectUsage } from "@/lib/hooks";
import { gql, getToken } from "@/lib/railway";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function ProjectPage() {
  const { id } = useParams() as { id: string };
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { data: projData, isLoading } = useProject(id);
  const { data: wsData } = useWorkspaces();
  const wsId = wsData?.me?.workspaces?.[0]?.id || "";
  const { data: usageData } = useProjectUsage(wsId, id);

  const project = projData?.project;
  const services = project?.services?.edges?.map((e: any) => e.node) || [];
  const envs = project?.environments?.edges?.map((e: any) => e.node) || [];
  const envId = envs[0]?.id || "";

  // Build usage map
  const usageMap: Record<string, { cpu: number; memory: number; disk: number; network: number }> = {};
  for (const row of (usageData?.usage || [])) {
    const sid = row.tags.serviceId;
    if (!usageMap[sid]) usageMap[sid] = { cpu: 0, memory: 0, disk: 0, network: 0 };
    if (row.measurement === "CPU_USAGE") usageMap[sid].cpu = row.value;
    else if (row.measurement === "MEMORY_USAGE_GB") usageMap[sid].memory = row.value;
    else if (row.measurement === "DISK_USAGE_GB") usageMap[sid].disk = row.value;
    else usageMap[sid].network += row.value;
  }

  // Fetch service statuses
  const token = getToken() || "";
  const { data: statusData } = useQuery({
    queryKey: ["serviceStatuses", id, envId],
    queryFn: async () => {
      const results: Record<string, { status: string; deployId: string | null }> = {};
      for (const svc of services) {
        try {
          const si = await gql(token, `query($sid: String!, $eid: String!) { serviceInstance(serviceId: $sid, environmentId: $eid) { activeDeployments { id status } latestDeployment { id status } } }`, { sid: svc.id, eid: envId });
          const active = si.serviceInstance.activeDeployments?.[0];
          const latest = si.serviceInstance.latestDeployment;
          if (latest && ["BUILDING", "DEPLOYING", "INITIALIZING"].includes(latest.status)) {
            results[svc.id] = { status: latest.status, deployId: latest.id };
          } else if (active) {
            results[svc.id] = { status: "SUCCESS", deployId: active.id };
          } else if (latest) {
            results[svc.id] = { status: latest.status, deployId: latest.id };
          } else {
            results[svc.id] = { status: "NONE", deployId: null };
          }
        } catch { results[svc.id] = { status: "NONE", deployId: null }; }
      }
      return results;
    },
    enabled: mounted && services.length > 0 && !!envId && !!token,
    staleTime: 30_000,
  });

  if (!mounted || isLoading) return <p style={{ color: "#64748b" }}>Loading project...</p>;

  function statusDot(status: string) {
    if (status === "SUCCESS") return "#22c55e";
    if (["BUILDING", "DEPLOYING", "INITIALIZING"].includes(status)) return "#f59e0b";
    if (status === "FAILED" || status === "CRASHED") return "#ef4444";
    return "#64748b";
  }
  function statusLabel(status: string) {
    if (status === "SUCCESS") return "Running";
    if (status === "BUILDING") return "Building";
    if (status === "DEPLOYING") return "Deploying";
    if (status === "FAILED") return "Failed";
    return status;
  }

  const totalCpu = Object.values(usageMap).reduce((s, u) => s + u.cpu, 0);
  const totalMem = Object.values(usageMap).reduce((s, u) => s + u.memory, 0);
  const totalDisk = Object.values(usageMap).reduce((s, u) => s + u.disk, 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/dashboard" style={{ fontSize: 12, color: "#94a3b8" }}>← Projects</Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{project?.name}</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>CPU</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#a78bfa" }}>{totalCpu.toFixed(2)} <span style={{ fontSize: 11, fontWeight: 400 }}>vCPU·h</span></div>
        </div>
        <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Memory</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>{totalMem.toFixed(1)} <span style={{ fontSize: 11, fontWeight: 400 }}>GB·h</span></div>
        </div>
        <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Disk</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>{totalDisk.toFixed(1)} <span style={{ fontSize: 11, fontWeight: 400 }}>GB·h</span></div>
        </div>
        <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Services</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#06b6d4" }}>{services.length}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {envs.map((e: any) => (
          <span key={e.id} style={{ background: "#2d3548", color: "#a78bfa", fontSize: 12, padding: "5px 12px", borderRadius: 6, fontWeight: 500 }}>{e.name}</span>
        ))}
      </div>

      <h2 style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 12, textTransform: "uppercase" }}>Services</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {services.map((s: any) => {
          const st = statusData?.[s.id]?.status || "NONE";
          const usage = usageMap[s.id] || { cpu: 0, memory: 0, disk: 0, network: 0 };
          return (
            <Link key={s.id} href={`/dashboard/project/${id}/service/${s.id}?env=${envId}`}>
              <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusDot(st), animation: ["BUILDING", "DEPLOYING"].includes(st) ? "pulse 1.5s infinite" : "none" }}></span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: statusDot(st), fontWeight: 600 }}>{statusLabel(st)}</span>
                </div>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <div><div style={{ fontSize: 9, color: "#64748b" }}>CPU</div><div style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa" }}>{usage.cpu.toFixed(3)}</div></div>
                  <div><div style={{ fontSize: 9, color: "#64748b" }}>MEM</div><div style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>{usage.memory.toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 9, color: "#64748b" }}>DISK</div><div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b" }}>{usage.disk.toFixed(1)}</div></div>
                  <div><div style={{ fontSize: 9, color: "#64748b" }}>NET</div><div style={{ fontSize: 12, fontWeight: 600, color: "#06b6d4" }}>{usage.network.toFixed(4)}</div></div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
