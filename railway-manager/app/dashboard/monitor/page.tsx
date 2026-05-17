"use client";
import { useEffect, useState } from "react";
import { gql, getToken } from "@/lib/railway";

interface ServiceUsage {
  id: string; name: string;
  cpu: number; memory: number; disk: number; networkIn: number; networkOut: number;
}

export default function MonitorPage() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [services, setServices] = useState<ServiceUsage[]>([]);
  const [limits, setLimits] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [wsId, setWsId] = useState("");

  useEffect(() => {
    const t = getToken(); if (!t) return;
    (async () => {
      const ws = await gql(t, `query { me { workspaces { id } } }`);
      const wId = ws.me.workspaces[0]?.id;
      if (!wId) return;
      setWsId(wId);
      const pd = await gql(t, `query($id: String!) { workspace(workspaceId: $id) { subscriptionPlanLimit projects { edges { node { id name } } } } }`, { id: wId });
      setProjects(pd.workspace.projects.edges.map((e: any) => e.node));
      setLimits(pd.workspace.subscriptionPlanLimit);
      if (pd.workspace.projects.edges.length > 0) {
        setSelectedProject(pd.workspace.projects.edges[0].node.id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProject || !wsId) return;
    loadServiceUsage();
  }, [selectedProject]);

  async function loadServiceUsage() {
    const t = getToken(); if (!t) return;
    setLoading(true);
    try {
      // Get service names
      const proj = await gql(t, `query($id: String!) { project(id: $id) { services { edges { node { id name } } } } }`, { id: selectedProject });
      const svcMap: Record<string, string> = {};
      for (const e of proj.project.services.edges) svcMap[e.node.id] = e.node.name;

      // Get per-service usage
      const u = await gql(t, `query($wid: String!, $pid: String!) { usage(workspaceId: $wid, projectId: $pid, measurements: [CPU_USAGE, MEMORY_USAGE_GB, DISK_USAGE_GB, NETWORK_TX_GB, NETWORK_RX_GB], groupBy: [SERVICE_ID]) { measurement tags { serviceId } value } }`, { wid: wsId, pid: selectedProject });

      const map: Record<string, ServiceUsage> = {};
      for (const [sid, name] of Object.entries(svcMap)) {
        map[sid] = { id: sid, name, cpu: 0, memory: 0, disk: 0, networkIn: 0, networkOut: 0 };
      }
      for (const row of (u.usage || [])) {
        const sid = row.tags.serviceId;
        if (!map[sid]) map[sid] = { id: sid, name: sid.slice(0, 8), cpu: 0, memory: 0, disk: 0, networkIn: 0, networkOut: 0 };
        if (row.measurement === "CPU_USAGE") map[sid].cpu = row.value;
        else if (row.measurement === "MEMORY_USAGE_GB") map[sid].memory = row.value;
        else if (row.measurement === "DISK_USAGE_GB") map[sid].disk = row.value;
        else if (row.measurement === "NETWORK_TX_GB") map[sid].networkOut = row.value;
        else if (row.measurement === "NETWORK_RX_GB") map[sid].networkIn = row.value;
      }
      setServices(Object.values(map).sort((a, b) => (b.cpu + b.memory) - (a.cpu + a.memory)));
    } catch {}
    setLoading(false);
  }

  // Find max values for relative bar sizing
  const maxCpu = Math.max(...services.map(s => s.cpu), 0.01);
  const maxMem = Math.max(...services.map(s => s.memory), 0.01);
  const maxDisk = Math.max(...services.map(s => s.disk), 0.01);

  // Thresholds for alerts (relative to max in project)
  function getLevel(value: number, max: number): "normal" | "warning" | "critical" {
    const pct = max > 0 ? value / max : 0;
    if (pct > 0.8) return "critical";
    if (pct > 0.5) return "warning";
    return "normal";
  }

  const levelColors = { normal: "#22c55e", warning: "#f59e0b", critical: "#ef4444" };

  // Critical services
  const criticalServices = services.filter(s =>
    getLevel(s.cpu, maxCpu) === "critical" || getLevel(s.memory, maxMem) === "critical"
  );

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
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fca5a5", marginBottom: 8 }}>⚠️ High Resource Usage Detected</div>
          {criticalServices.map(s => (
            <div key={s.id} style={{ fontSize: 12, color: "#fca5a5", marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{s.name}</span> — CPU: {s.cpu.toFixed(3)} vCPU·h, Memory: {s.memory.toFixed(1)} GB·h
            </div>
          ))}
        </div>
      )}

      {/* Service cards with bars */}
      {!loading && services.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {services.map(s => {
            const cpuLevel = getLevel(s.cpu, maxCpu);
            const memLevel = getLevel(s.memory, maxMem);
            const diskLevel = getLevel(s.disk, maxDisk);
            const hasCritical = cpuLevel === "critical" || memLevel === "critical";

            return (
              <div key={s.id} style={{ background: "#1e2330", border: `1px solid ${hasCritical ? "#7f1d1d" : "#2d3548"}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: hasCritical ? "#ef4444" : cpuLevel === "warning" || memLevel === "warning" ? "#f59e0b" : "#22c55e" }}></span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{s.name}</span>
                  </div>
                  {hasCritical && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#450a0a", color: "#fca5a5", fontWeight: 600 }}>HIGH USAGE</span>}
                </div>

                {/* CPU Bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
                    <span>CPU</span>
                    <span style={{ color: levelColors[cpuLevel], fontWeight: 600 }}>{s.cpu.toFixed(3)} vCPU·h</span>
                  </div>
                  <div style={{ height: 6, background: "#0f1117", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min((s.cpu / maxCpu) * 100, 100)}%`, background: levelColors[cpuLevel], borderRadius: 3, transition: "width 0.3s" }}></div>
                  </div>
                </div>

                {/* Memory Bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
                    <span>Memory</span>
                    <span style={{ color: levelColors[memLevel], fontWeight: 600 }}>{s.memory.toFixed(2)} GB·h</span>
                  </div>
                  <div style={{ height: 6, background: "#0f1117", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min((s.memory / maxMem) * 100, 100)}%`, background: levelColors[memLevel], borderRadius: 3, transition: "width 0.3s" }}></div>
                  </div>
                </div>

                {/* Disk Bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
                    <span>Disk</span>
                    <span style={{ color: levelColors[diskLevel], fontWeight: 600 }}>{s.disk.toFixed(1)} GB·h</span>
                  </div>
                  <div style={{ height: 6, background: "#0f1117", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min((s.disk / maxDisk) * 100, 100)}%`, background: levelColors[diskLevel], borderRadius: 3, transition: "width 0.3s" }}></div>
                  </div>
                </div>

                {/* Network */}
                <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    <span style={{ color: "#06b6d4" }}>↑</span> Out: <span style={{ color: "#06b6d4", fontWeight: 600 }}>{s.networkOut.toFixed(4)} GB</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    <span style={{ color: "#ec4899" }}>↓</span> In: <span style={{ color: "#ec4899", fontWeight: 600 }}>{s.networkIn.toFixed(4)} GB</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && services.length === 0 && (
        <p style={{ color: "#64748b", textAlign: "center", padding: 40 }}>No usage data for this project yet</p>
      )}
    </div>
  );
}
