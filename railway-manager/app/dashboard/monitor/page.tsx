"use client";
import { useEffect, useState } from "react";
import { gql, getToken } from "@/lib/railway";

interface ServiceMetrics {
  id: string; name: string;
  cpu: number; memory: number; disk: number; networkIn: number; networkOut: number;
  cpuLimit: number | null; memoryLimitGB: number | null;
}

export default function MonitorPage() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [services, setServices] = useState<ServiceMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [wsId, setWsId] = useState("");
  const [envId, setEnvId] = useState("");

  useEffect(() => {
    const t = getToken(); if (!t) return;
    (async () => {
      const ws = await gql(t, `query { me { workspaces { id } } }`);
      const wId = ws.me.workspaces[0]?.id;
      if (!wId) return;
      setWsId(wId);
      const pd = await gql(t, `query($id: String!) { workspace(workspaceId: $id) { projects { edges { node { id name environments { edges { node { id name } } } } } } } }`, { id: wId });
      const projs = pd.workspace.projects.edges.map((e: any) => e.node);
      setProjects(projs);
      if (projs.length > 0) {
        setSelectedProject(projs[0].id);
        setEnvId(projs[0].environments?.edges?.[0]?.node?.id || "");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProject || !wsId) return;
    const proj = projects.find(p => p.id === selectedProject) as any;
    if (proj?.environments?.edges?.[0]) setEnvId(proj.environments.edges[0].node.id);
    loadServiceMetrics();
  }, [selectedProject]);

  async function loadServiceMetrics() {
    const t = getToken(); if (!t) return;
    setLoading(true);
    try {
      // Get services
      const proj = await gql(t, `query($id: String!) { project(id: $id) { services { edges { node { id name } } } environments { edges { node { id } } } } }`, { id: selectedProject });
      const svcList = proj.project.services.edges.map((e: any) => e.node);
      const eId = proj.project.environments.edges[0]?.node?.id || envId;

      // Get usage
      const u = await gql(t, `query($wid: String!, $pid: String!) { usage(workspaceId: $wid, projectId: $pid, measurements: [CPU_USAGE, MEMORY_USAGE_GB, DISK_USAGE_GB, NETWORK_TX_GB, NETWORK_RX_GB], groupBy: [SERVICE_ID]) { measurement tags { serviceId } value } }`, { wid: wsId, pid: selectedProject });

      // Get limits for each service
      const results: ServiceMetrics[] = [];
      for (const svc of svcList) {
        const usage: ServiceMetrics = { id: svc.id, name: svc.name, cpu: 0, memory: 0, disk: 0, networkIn: 0, networkOut: 0, cpuLimit: null, memoryLimitGB: null };

        // Fill usage from query
        for (const row of (u.usage || [])) {
          if (row.tags.serviceId !== svc.id) continue;
          if (row.measurement === "CPU_USAGE") usage.cpu = row.value;
          else if (row.measurement === "MEMORY_USAGE_GB") usage.memory = row.value;
          else if (row.measurement === "DISK_USAGE_GB") usage.disk = row.value;
          else if (row.measurement === "NETWORK_TX_GB") usage.networkOut = row.value;
          else if (row.measurement === "NETWORK_RX_GB") usage.networkIn = row.value;
        }

        // Get allocated limits
        try {
          const lm = await gql(t, `query($sid: String!, $eid: String!) { serviceInstanceLimits(serviceId: $sid, environmentId: $eid) }`, { sid: svc.id, eid: eId });
          const containers = lm.serviceInstanceLimits?.containers;
          if (containers) {
            usage.cpuLimit = containers.cpu || null;
            usage.memoryLimitGB = containers.memoryBytes ? containers.memoryBytes / 1073741824 : null;
          }
        } catch {}

        results.push(usage);
      }

      setServices(results.sort((a, b) => (b.cpu + b.memory) - (a.cpu + a.memory)));
    } catch {}
    setLoading(false);
  }

  // Calculate usage percentage against actual limit
  // Usage values are in resource-hours for the billing period
  // Limits are the allocated capacity (vCPU, GB)
  // To get utilization: usage_hours / (limit * hours_elapsed)
  function getUtilization(usageHours: number, limit: number | null): number | null {
    if (!limit || limit === 0) return null;
    const periodStart = Date.now() - 2 * 24 * 60 * 60 * 1000; // approximate billing start
    const hoursElapsed = Math.max((Date.now() - periodStart) / 3600000, 1);
    const avgUsage = usageHours / hoursElapsed;
    return (avgUsage / limit) * 100;
  }

  function getLevel(pct: number | null): "normal" | "warning" | "critical" | "unknown" {
    if (pct === null) return "unknown";
    if (pct > 80) return "critical";
    if (pct > 60) return "warning";
    return "normal";
  }

  const levelColors = { normal: "#22c55e", warning: "#f59e0b", critical: "#ef4444", unknown: "#64748b" };
  const levelLabels = { normal: "Normal", warning: "Warning", critical: "Critical", unknown: "—" };

  const criticalServices = services.filter(s => {
    const cpuPct = getUtilization(s.cpu, s.cpuLimit);
    const memPct = getUtilization(s.memory, s.memoryLimitGB);
    return getLevel(cpuPct) === "critical" || getLevel(memPct) === "critical";
  });

  const selectStyle: React.CSSProperties = { padding: "8px 12px", background: "#0f1117", border: "1px solid #374151", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", minWidth: 200 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Monitor</h1>
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={selectStyle}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading && <p style={{ color: "#64748b" }}>Loading metrics...</p>}

      {/* Alerts */}
      {criticalServices.length > 0 && (
        <div style={{ background: "#2d1b1b", border: "1px solid #7f1d1d", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fca5a5", marginBottom: 8 }}>⚠️ Services exceeding 80% of allocated resources</div>
          {criticalServices.map(s => {
            const cpuPct = getUtilization(s.cpu, s.cpuLimit);
            const memPct = getUtilization(s.memory, s.memoryLimitGB);
            return (
              <div key={s.id} style={{ fontSize: 12, color: "#fca5a5", marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                {cpuPct !== null && cpuPct > 80 && <span> — CPU: {cpuPct.toFixed(0)}% of {s.cpuLimit} vCPU</span>}
                {memPct !== null && memPct > 80 && <span> — Memory: {memPct.toFixed(0)}% of {s.memoryLimitGB?.toFixed(1)} GB</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Service cards */}
      {!loading && services.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {services.map(s => {
            const cpuPct = getUtilization(s.cpu, s.cpuLimit);
            const memPct = getUtilization(s.memory, s.memoryLimitGB);
            const cpuLevel = getLevel(cpuPct);
            const memLevel = getLevel(memPct);
            const hasCritical = cpuLevel === "critical" || memLevel === "critical";
            const hasWarning = cpuLevel === "warning" || memLevel === "warning";

            return (
              <div key={s.id} style={{ background: "#1e2330", border: `1px solid ${hasCritical ? "#7f1d1d" : hasWarning ? "#78350f" : "#2d3548"}`, borderRadius: 10, padding: 16 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: hasCritical ? "#ef4444" : hasWarning ? "#f59e0b" : "#22c55e" }}></span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{s.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {s.cpuLimit && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#0f1117", color: "#94a3b8" }}>{s.cpuLimit} vCPU</span>}
                    {s.memoryLimitGB && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#0f1117", color: "#94a3b8" }}>{s.memoryLimitGB.toFixed(1)} GB</span>}
                  </div>
                </div>

                {/* CPU */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
                    <span>CPU {cpuPct !== null ? `(${cpuPct.toFixed(0)}% of limit)` : ""}</span>
                    <span style={{ color: levelColors[cpuLevel], fontWeight: 600 }}>{s.cpu.toFixed(3)} vCPU·h {s.cpuLimit ? `/ ${s.cpuLimit} vCPU allocated` : ""}</span>
                  </div>
                  <div style={{ height: 8, background: "#0f1117", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(cpuPct || 0, 100)}%`, background: levelColors[cpuLevel], borderRadius: 4 }}></div>
                  </div>
                </div>

                {/* Memory */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
                    <span>Memory {memPct !== null ? `(${memPct.toFixed(0)}% of limit)` : ""}</span>
                    <span style={{ color: levelColors[memLevel], fontWeight: 600 }}>{s.memory.toFixed(2)} GB·h {s.memoryLimitGB ? `/ ${s.memoryLimitGB.toFixed(1)} GB allocated` : ""}</span>
                  </div>
                  <div style={{ height: 8, background: "#0f1117", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(memPct || 0, 100)}%`, background: levelColors[memLevel], borderRadius: 4 }}></div>
                  </div>
                </div>

                {/* Disk + Network row */}
                <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Disk: <span style={{ color: "#f59e0b", fontWeight: 600 }}>{s.disk.toFixed(1)} GB·h</span></div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Net ↑: <span style={{ color: "#06b6d4", fontWeight: 600 }}>{s.networkOut.toFixed(4)} GB</span></div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Net ↓: <span style={{ color: "#ec4899", fontWeight: 600 }}>{s.networkIn.toFixed(4)} GB</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && services.length === 0 && (
        <p style={{ color: "#64748b", textAlign: "center", padding: 40 }}>No usage data for this project</p>
      )}
    </div>
  );
}
