"use client";
import { useEffect, useState } from "react";
import { gql, getToken } from "@/lib/railway";
import Link from "next/link";

interface ServiceMetrics {
  id: string; name: string;
  currentCpu: number; currentMemoryGB: number;
  cpuLimit: number | null; memoryLimitGB: number | null;
  cpuPct: number | null; memPct: number | null;
}

export default function MonitorPage() {
  const [projects, setProjects] = useState<{ id: string; name: string; envId: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [services, setServices] = useState<ServiceMetrics[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = getToken(); if (!t) return;
    (async () => {
      const ws = await gql(t, `query { me { workspaces { id } } }`);
      const wId = ws.me.workspaces[0]?.id;
      if (!wId) return;
      const pd = await gql(t, `query($id: String!) { workspace(workspaceId: $id) { projects { edges { node { id name environments { edges { node { id } } } } } } } }`, { id: wId });
      const projs = pd.workspace.projects.edges.map((e: any) => ({
        id: e.node.id, name: e.node.name, envId: e.node.environments?.edges?.[0]?.node?.id || ""
      }));
      setProjects(projs);
      if (projs.length > 0) setSelectedProject(projs[0].id);
    })();
  }, []);

  useEffect(() => { if (selectedProject) loadMetrics(); }, [selectedProject]);

  async function loadMetrics() {
    const t = getToken(); if (!t) return;
    const proj = projects.find(p => p.id === selectedProject);
    if (!proj) return;
    setLoading(true);

    try {
      // Get services
      const pd = await gql(t, `query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }`, { id: selectedProject });
      const svcList = pd.project.services.edges.map((e: any) => e.node);
      const startDate = new Date(Date.now() - 2 * 60000).toISOString(); // last 2 minutes

      const results: ServiceMetrics[] = [];

      for (const svc of svcList) {
        let currentCpu = 0, currentMemoryGB = 0, cpuLimit: number | null = null, memoryLimitGB: number | null = null;

        // Get real-time metrics (last 2 min, 60s sample)
        try {
          const m = await gql(t, `query($pid: String!, $eid: String!, $sid: String!, $start: DateTime!) { metrics(projectId: $pid, environmentId: $eid, serviceId: $sid, startDate: $start, measurements: [CPU_USAGE, MEMORY_USAGE_GB], sampleRateSeconds: 60) { measurement values { ts value } } }`,
            { pid: selectedProject, eid: proj.envId, sid: svc.id, start: startDate });
          for (const metric of (m.metrics || [])) {
            const lastVal = metric.values?.[metric.values.length - 1]?.value || 0;
            if (metric.measurement === "CPU_USAGE") currentCpu = lastVal;
            else if (metric.measurement === "MEMORY_USAGE_GB") currentMemoryGB = lastVal;
          }
        } catch {}

        // Get allocated limits
        try {
          const lm = await gql(t, `query($sid: String!, $eid: String!) { serviceInstanceLimits(serviceId: $sid, environmentId: $eid) }`, { sid: svc.id, eid: proj.envId });
          const c = lm.serviceInstanceLimits?.containers;
          if (c) {
            cpuLimit = c.cpu || null;
            memoryLimitGB = c.memoryBytes ? c.memoryBytes / 1073741824 : null;
          }
        } catch {}

        const cpuPct = cpuLimit ? (currentCpu / cpuLimit) * 100 : null;
        const memPct = memoryLimitGB ? (currentMemoryGB / memoryLimitGB) * 100 : null;

        results.push({ id: svc.id, name: svc.name, currentCpu, currentMemoryGB, cpuLimit, memoryLimitGB, cpuPct, memPct });
      }

      setServices(results.sort((a, b) => ((b.memPct || 0) + (b.cpuPct || 0)) - ((a.memPct || 0) + (a.cpuPct || 0))));
    } catch {}
    setLoading(false);
  }

  function getLevel(pct: number | null): "normal" | "warning" | "critical" | "unknown" {
    if (pct === null) return "unknown";
    if (pct > 80) return "critical";
    if (pct > 60) return "warning";
    return "normal";
  }

  const levelColors = { normal: "#22c55e", warning: "#f59e0b", critical: "#ef4444", unknown: "#64748b" };

  const criticalServices = services.filter(s => getLevel(s.cpuPct) === "critical" || getLevel(s.memPct) === "critical");
  const warningServices = services.filter(s => (getLevel(s.cpuPct) === "warning" || getLevel(s.memPct) === "warning") && getLevel(s.cpuPct) !== "critical" && getLevel(s.memPct) !== "critical");

  const selectStyle: React.CSSProperties = { padding: "8px 12px", background: "#0f1117", border: "1px solid #374151", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none", minWidth: 200 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Monitor</h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Real-time resource utilization (current usage vs allocated limits)</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={selectStyle}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={loadMetrics} style={{ padding: "8px 12px", background: "#2d3548", border: "none", borderRadius: 8, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>↻ Refresh</button>
        </div>
      </div>

      {loading && <p style={{ color: "#64748b" }}>Fetching live metrics...</p>}

      {/* Critical alerts */}
      {criticalServices.length > 0 && (
        <div style={{ background: "#2d1b1b", border: "1px solid #7f1d1d", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fca5a5", marginBottom: 8 }}>🔴 Critical — Exceeding 80% of allocated resources</div>
          {criticalServices.map(s => (
            <div key={s.id} style={{ fontSize: 12, color: "#fca5a5", marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{s.name}</span>
              {s.cpuPct !== null && s.cpuPct > 80 && <span> — CPU: {s.cpuPct.toFixed(1)}% ({s.currentCpu.toFixed(6)} / {s.cpuLimit} vCPU)</span>}
              {s.memPct !== null && s.memPct > 80 && <span> — Mem: {s.memPct.toFixed(1)}% ({(s.currentMemoryGB * 1024).toFixed(0)} MB / {((s.memoryLimitGB || 0) * 1024).toFixed(0)} MB)</span>}
            </div>
          ))}
        </div>
      )}

      {/* Warning alerts */}
      {warningServices.length > 0 && (
        <div style={{ background: "#1a1a0f", border: "1px solid #78350f", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fcd34d", marginBottom: 8 }}>🟡 Warning — Above 60% utilization</div>
          {warningServices.map(s => (
            <div key={s.id} style={{ fontSize: 12, color: "#fcd34d", marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{s.name}</span>
              {s.cpuPct !== null && s.cpuPct > 60 && <span> — CPU: {s.cpuPct.toFixed(1)}%</span>}
              {s.memPct !== null && s.memPct > 60 && <span> — Mem: {s.memPct.toFixed(1)}%</span>}
            </div>
          ))}
        </div>
      )}

      {/* Service cards */}
      {!loading && services.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {services.map(s => {
            const cpuLevel = getLevel(s.cpuPct);
            const memLevel = getLevel(s.memPct);
            const worst = cpuLevel === "critical" || memLevel === "critical" ? "critical" : cpuLevel === "warning" || memLevel === "warning" ? "warning" : "normal";

            return (
              <Link key={s.id} href={`/dashboard/project/${selectedProject}/service/${s.id}?env=${proj?.envId || ""}&tab=resources`} style={{ textDecoration: "none" }}>
              <div style={{ background: "#1e2330", border: `1px solid ${worst === "critical" ? "#7f1d1d" : worst === "warning" ? "#78350f" : "#2d3548"}`, borderRadius: 10, padding: 16, cursor: "pointer" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: levelColors[worst] }}></span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{s.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {s.cpuLimit && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#0f1117", color: "#a78bfa" }}>Limit: {s.cpuLimit} vCPU</span>}
                    {s.memoryLimitGB && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#0f1117", color: "#22c55e" }}>Limit: {(s.memoryLimitGB * 1024).toFixed(0)} MB</span>}
                  </div>
                </div>

                {/* CPU */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                    <span>CPU — {s.cpuPct !== null ? `${s.cpuPct.toFixed(1)}% utilized` : "no limit set"}</span>
                    <span style={{ color: levelColors[cpuLevel], fontWeight: 600 }}>
                      {(s.currentCpu * 1000).toFixed(2)} mCPU / {s.cpuLimit ? `${s.cpuLimit * 1000} mCPU` : "shared"}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#0f1117", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(s.cpuPct || 0, 100)}%`, background: levelColors[cpuLevel], borderRadius: 4 }}></div>
                  </div>
                </div>

                {/* Memory */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                    <span>Memory — {s.memPct !== null ? `${s.memPct.toFixed(1)}% utilized` : "no limit set"}</span>
                    <span style={{ color: levelColors[memLevel], fontWeight: 600 }}>
                      {(s.currentMemoryGB * 1024).toFixed(1)} MB / {s.memoryLimitGB ? `${(s.memoryLimitGB * 1024).toFixed(0)} MB` : "shared"}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#0f1117", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(s.memPct || 0, 100)}%`, background: levelColors[memLevel], borderRadius: 4 }}></div>
                  </div>
                </div>
              </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && services.length === 0 && (
        <p style={{ color: "#64748b", textAlign: "center", padding: 40 }}>No services in this project</p>
      )}
    </div>
  );
}
