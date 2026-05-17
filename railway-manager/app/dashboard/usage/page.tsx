"use client";
import { useEffect, useState } from "react";
import { gql, getToken } from "@/lib/railway";

// Railway pricing not needed — we fetch actual dollar amounts from the API directly

interface UsageRow { measurement: string; tags: { projectId: string; serviceId: string }; value: number; }
interface EstimatedRow { projectId: string; measurement: string; estimatedValue: number; }

export default function UsagePage() {
  const [perService, setPerService] = useState<UsageRow[]>([]);
  const [estimated, setEstimated] = useState<EstimatedRow[]>([]);
  const [planInfo, setPlanInfo] = useState<any>(null);
  const [billing, setBilling] = useState<{ currentUsage: number; start: string; end: string; hardLimit: number; softLimit: number; credits: number } | null>(null);
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

        // Plan
        const pi = await gql(t, `query($id: String!) { workspace(workspaceId: $id) { plan subscriptionPlanLimit customer { currentUsage billingPeriod { start end } usageLimit { hardLimit softLimit } creditBalance } } }`, { id: wsId });
        setPlanInfo({ plan: pi.workspace.plan, limits: pi.workspace.subscriptionPlanLimit });
        const cust = pi.workspace.customer;
        setBilling({
          currentUsage: cust.currentUsage,
          start: cust.billingPeriod.start,
          end: cust.billingPeriod.end,
          hardLimit: cust.usageLimit.hardLimit,
          softLimit: cust.usageLimit.softLimit,
          credits: cust.creditBalance,
        });

        // Estimated (monthly forecast)
        const est = await gql(t, `query($id: String!) { estimatedUsage(workspaceId: $id, measurements: [CPU_USAGE, MEMORY_USAGE_GB, DISK_USAGE_GB, NETWORK_TX_GB, NETWORK_RX_GB]) { projectId measurement estimatedValue } }`, { id: wsId });
        setEstimated(est.estimatedUsage || []);

        // Per-service usage (current period)
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

  // Calculate estimated bill by projecting current usage to end of period
  let estimatedBill = 0;
  if (billing) {
    const start = new Date(billing.start).getTime();
    const end = new Date(billing.end).getTime();
    const now = Date.now();
    const elapsed = now - start;
    const total = end - start;
    const ratio = total / elapsed;
    estimatedBill = billing.currentUsage * ratio;
  }

  const forecastTotal = estimatedBill;
  const byProject: Record<string, EstimatedRow[]> = {};
  for (const e of estimated) { if (!byProject[e.projectId]) byProject[e.projectId] = []; byProject[e.projectId].push(e); }

  // Per-service grouped
  const svcUsage: Record<string, Record<string, UsageRow[]>> = {}; // projectId -> serviceId -> rows
  for (const row of perService) {
    const pid = row.tags.projectId;
    const sid = row.tags.serviceId;
    if (!svcUsage[pid]) svcUsage[pid] = {};
    if (!svcUsage[pid][sid]) svcUsage[pid][sid] = [];
    svcUsage[pid][sid].push(row);
  }

  const limits = planInfo?.limits;
  const containers = limits?.containers;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Usage & Billing</h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Monthly forecast and per-service breakdown</p>

      {/* Top row: Plan + Billing */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Current Plan</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa" }}>{planInfo?.plan}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
            {containers?.cpuDescription} CPU • {containers?.memoryDescription} RAM • {containers?.diskDescription} Disk
          </div>
        </div>
        <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Current Usage</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>${billing?.currentUsage.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
            {billing ? `${new Date(billing.start).toLocaleDateString()} — ${new Date(billing.end).toLocaleDateString()}` : ""}
          </div>
        </div>
        <div style={{ background: "#1e2330", border: "1px solid #7c3aed", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Estimated Bill</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>${forecastTotal.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
            Limit: ${billing?.softLimit} soft / ${billing?.hardLimit} hard
          </div>
        </div>
      </div>

      {/* Per-project forecast */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Usage by Project (estimated)</h2>
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {Object.entries(byProject).map(([pid, items]) => {
          const cpu = items.find(i => i.measurement === "CPU_USAGE")?.estimatedValue || 0;
          const mem = items.find(i => i.measurement === "MEMORY_USAGE_GB")?.estimatedValue || 0;
          const disk = items.find(i => i.measurement === "DISK_USAGE_GB")?.estimatedValue || 0;
          return (
            <a key={pid} href={`/dashboard/project/${pid}`} style={{ textDecoration: "none" }}>
              <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 16, cursor: "pointer", transition: "0.15s" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6 }}>{projects[pid] || pid.slice(0, 12)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <div><div style={{ fontSize: 10, color: "#64748b" }}>CPU (projected)</div><div style={{ fontSize: 14, fontWeight: 600, color: "#a78bfa" }}>{cpu.toFixed(1)} vCPU·h</div></div>
                <div><div style={{ fontSize: 10, color: "#64748b" }}>Memory (projected)</div><div style={{ fontSize: 14, fontWeight: 600, color: "#22c55e" }}>{mem.toFixed(0)} GB·h</div></div>
                <div><div style={{ fontSize: 10, color: "#64748b" }}>Disk (projected)</div><div style={{ fontSize: 14, fontWeight: 600, color: "#f59e0b" }}>{disk.toFixed(0)} GB·h</div></div>
              </div>
            </div>
            </a>
          );
        })}
      </div>

      {/* Per-service breakdown */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Current Period — Per Service</h2>
      {Object.entries(svcUsage).map(([pid, svcs]) => (
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
              </tr>
            </thead>
            <tbody>
              {Object.entries(svcs).map(([sid, rows]) => {
                const cpu = rows.find(r => r.measurement === "CPU_USAGE")?.value || 0;
                const mem = rows.find(r => r.measurement === "MEMORY_USAGE_GB")?.value || 0;
                const disk = rows.find(r => r.measurement === "DISK_USAGE_GB")?.value || 0;
                const net = (rows.find(r => r.measurement === "NETWORK_TX_GB")?.value || 0) + (rows.find(r => r.measurement === "NETWORK_RX_GB")?.value || 0);
                return (
                  <tr key={sid} style={{ borderBottom: "1px solid #1e2330" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{services[sid] || sid.slice(0, 12)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#a78bfa", textAlign: "right" }}>{cpu.toFixed(3)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#22c55e", textAlign: "right" }}>{mem.toFixed(2)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#f59e0b", textAlign: "right" }}>{disk.toFixed(2)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#06b6d4", textAlign: "right" }}>{net.toFixed(4)}</td>
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
