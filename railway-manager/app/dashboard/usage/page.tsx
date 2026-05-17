"use client";
import { useEffect, useState } from "react";
import { gql, getToken } from "@/lib/railway";
import Link from "next/link";

interface UsageRow { measurement: string; tags: { projectId: string; serviceId: string }; value: number; }
interface EstimatedRow { projectId: string; measurement: string; estimatedValue: number; }

export default function UsagePage() {
  const [perService, setPerService] = useState<UsageRow[]>([]);
  const [estimated, setEstimated] = useState<EstimatedRow[]>([]);
  const [planInfo, setPlanInfo] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [services, setServices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = getToken(); if (!t) return;
    (async () => {
      try {
        const ws = await gql(t, `query { me { workspaces { id } } }`);
        const wsId = ws.me.workspaces[0]?.id;
        if (!wsId) { setLoading(false); return; }

        // Billing + Plan
        const pi = await gql(t, `query($id: String!) { workspace(workspaceId: $id) { plan subscriptionPlanLimit customer { currentUsage billingPeriod { start end } usageLimit { hardLimit softLimit } creditBalance } } }`, { id: wsId });
        setPlanInfo({ plan: pi.workspace.plan, limits: pi.workspace.subscriptionPlanLimit });
        setBilling(pi.workspace.customer);

        // Estimated (monthly projection per project)
        const est = await gql(t, `query($id: String!) { estimatedUsage(workspaceId: $id, measurements: [CPU_USAGE, MEMORY_USAGE_GB, DISK_USAGE_GB, NETWORK_TX_GB, NETWORK_RX_GB]) { projectId measurement estimatedValue } }`, { id: wsId });
        setEstimated(est.estimatedUsage || []);

        // Per-service current usage
        const u = await gql(t, `query($id: String!) { usage(workspaceId: $id, measurements: [CPU_USAGE, MEMORY_USAGE_GB, DISK_USAGE_GB, NETWORK_TX_GB, NETWORK_RX_GB], groupBy: [PROJECT_ID, SERVICE_ID]) { measurement tags { projectId serviceId } value } }`, { id: wsId });
        setPerService(u.usage || []);

        // Names
        const pd = await gql(t, `query($id: String!) { workspace(workspaceId: $id) { projects { edges { node { id name services { edges { node { id name } } } } } } } }`, { id: wsId });
        const pMap: Record<string, string> = {};
        const sMap: Record<string, string> = {};
        for (const p of pd.workspace.projects.edges) {
          pMap[p.node.id] = p.node.name;
          for (const s of p.node.services.edges) sMap[s.node.id] = s.node.name;
        }
        setProjects(pMap); setServices(sMap);
      } catch (e: any) { setError(e.message); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <p style={{ color: "#64748b" }}>Loading usage...</p>;
  if (error) return <p style={{ color: "#fca5a5" }}>Error: {error}</p>;

  const currentUsage = billing?.currentUsage || 0;
  const periodStart = billing?.billingPeriod?.start;
  const periodEnd = billing?.billingPeriod?.end;

  // Calculate estimated bill by projecting
  let estimatedBill = 0;
  if (periodStart && periodEnd) {
    const elapsed = Date.now() - new Date(periodStart).getTime();
    const total = new Date(periodEnd).getTime() - new Date(periodStart).getTime();
    estimatedBill = elapsed > 0 ? currentUsage * (total / elapsed) : 0;
  }

  // Proportional cost per project: distribute currentUsage based on resource weight
  const totalEstimatedWeight = estimated.reduce((s, e) => s + e.estimatedValue, 0);
  function projectCost(pid: string) {
    const projWeight = estimated.filter(e => e.projectId === pid).reduce((s, e) => s + e.estimatedValue, 0);
    return totalEstimatedWeight > 0 ? (projWeight / totalEstimatedWeight) * currentUsage : 0;
  }

  // Per-service: distribute project cost by service resource weight
  function serviceCost(pid: string, sid: string) {
    const projRows = perService.filter(r => r.tags.projectId === pid);
    const projTotal = projRows.reduce((s, r) => s + r.value, 0);
    const svcTotal = projRows.filter(r => r.tags.serviceId === sid).reduce((s, r) => s + r.value, 0);
    const pCost = projectCost(pid);
    return projTotal > 0 ? (svcTotal / projTotal) * pCost : 0;
  }

  // Group by project
  const byProject: Record<string, EstimatedRow[]> = {};
  for (const e of estimated) { if (!byProject[e.projectId]) byProject[e.projectId] = []; byProject[e.projectId].push(e); }

  // Per-service grouped
  const svcByProject: Record<string, Record<string, UsageRow[]>> = {};
  for (const row of perService) {
    const pid = row.tags.projectId;
    const sid = row.tags.serviceId;
    if (!svcByProject[pid]) svcByProject[pid] = {};
    if (!svcByProject[pid][sid]) svcByProject[pid][sid] = [];
    svcByProject[pid][sid].push(row);
  }

  const limits = planInfo?.limits;
  const containers = limits?.containers;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Usage & Billing</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        {periodStart && periodEnd ? `${new Date(periodStart).toLocaleDateString()} — ${new Date(periodEnd).toLocaleDateString()}` : "Current billing period"}
      </p>

      {/* Top cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Plan</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa" }}>{planInfo?.plan}</div>
        </div>
        <div style={{ background: "#1e2330", border: "1px solid #22c55e", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Current Usage</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>${currentUsage.toFixed(2)}</div>
        </div>
        <div style={{ background: "#1e2330", border: "1px solid #f59e0b", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Estimated Bill</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>${estimatedBill.toFixed(2)}</div>
        </div>
        <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Usage Limit</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>${billing?.usageLimit?.hardLimit || 0}</div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Soft: ${billing?.usageLimit?.softLimit || 0}</div>
        </div>
      </div>

      {/* Usage bar */}
      <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
          <span>Compute Usage</span>
          <span>${currentUsage.toFixed(2)} / ${billing?.usageLimit?.hardLimit || 20}.00</span>
        </div>
        <div style={{ height: 8, background: "#0f1117", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min((currentUsage / (billing?.usageLimit?.hardLimit || 20)) * 100, 100)}%`, background: "linear-gradient(90deg, #22c55e, #f59e0b)", borderRadius: 4 }}></div>
        </div>
      </div>

      {/* Per-project cost */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Cost by Project</h2>
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {Object.entries(byProject).map(([pid, items]) => {
          const cost = projectCost(pid);
          const cpu = items.find(i => i.measurement === "CPU_USAGE")?.estimatedValue || 0;
          const mem = items.find(i => i.measurement === "MEMORY_USAGE_GB")?.estimatedValue || 0;
          return (
            <Link key={pid} href={`/dashboard/project/${pid}`}>
              <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 16, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{projects[pid] || pid.slice(0, 12)}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>CPU: {cpu.toFixed(0)} vCPU·min • Mem: {mem.toFixed(0)} GB·min</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>${cost.toFixed(4)}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>this period</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Per-service breakdown */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Cost by Service</h2>
      {Object.entries(svcByProject).map(([pid, svcs]) => (
        <div key={pid} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 }}>{projects[pid] || pid.slice(0, 12)}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2d3548" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Service</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>CPU (vCPU·h)</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Memory (GB·h)</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Disk (GB·h)</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Network (GB)</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(svcs).map(([sid, rows]) => {
                const cpu = rows.find(r => r.measurement === "CPU_USAGE")?.value || 0;
                const mem = rows.find(r => r.measurement === "MEMORY_USAGE_GB")?.value || 0;
                const disk = rows.find(r => r.measurement === "DISK_USAGE_GB")?.value || 0;
                const net = (rows.find(r => r.measurement === "NETWORK_TX_GB")?.value || 0) + (rows.find(r => r.measurement === "NETWORK_RX_GB")?.value || 0);
                const cost = serviceCost(pid, sid);
                return (
                  <tr key={sid} style={{ borderBottom: "1px solid #1e2330" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{services[sid] || sid.slice(0, 12)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#a78bfa", textAlign: "right" }}>{cpu.toFixed(3)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#22c55e", textAlign: "right" }}>{mem.toFixed(2)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#f59e0b", textAlign: "right" }}>{disk.toFixed(2)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#06b6d4", textAlign: "right" }}>{net.toFixed(4)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#22c55e", textAlign: "right" }}>${cost.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Plan Limits */}
      {limits && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 12, marginTop: 24 }}>Plan Limits</h2>
          <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                ["Max CPU/svc", containers?.cpuDescription],
                ["Max Memory/svc", containers?.memoryDescription],
                ["Max Disk", containers?.diskDescription],
                ["Max Replicas", limits.deploys?.replicas],
                ["Projects", limits.projects],
                ["Services/project", limits.project?.services],
                ["Custom Domains", limits.networking?.customDomains],
                ["Concurrent Builds", limits.builds?.concurrent],
                ["Log Retention", `${limits.observability?.logRetentionDays}d`],
                ["Volumes/project", limits.volumes?.maxPerProject],
                ["Volume Size", `${(limits.volumes?.maxSizeMB || 0) / 1000}GB`],
                ["Build Timeout", `${limits.builds?.timeout?.hard}min`],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
