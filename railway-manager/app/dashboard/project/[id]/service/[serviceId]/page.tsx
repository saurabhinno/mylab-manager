"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { gql, getToken } from "@/lib/railway";
import Link from "next/link";

interface Deployment { id: string; status: string; createdAt: string; url: string | null; }

export default function ServicePage() {
  const { id: projectId, serviceId } = useParams();
  const searchParams = useSearchParams();
  const envId = searchParams.get("env") || "";
  const t = getToken() || "";

  const [tab, setTab] = useState<"deployments" | "variables" | "settings" | "resources" | "volumes" | "domains" | "logs">("deployments");
  const [serviceName, setServiceName] = useState("");
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<any>(null);
  const [limits, setLimits] = useState<any>(null);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [domains, setDomains] = useState<any>({ serviceDomains: [], customDomains: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Form states
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [startCmd, setStartCmd] = useState("");
  const [buildCmd, setBuildCmd] = useState("");
  const [rootDir, setRootDir] = useState("");
  const [healthcheck, setHealthcheck] = useState("");
  const [replicas, setReplicas] = useState(1);
  const [region, setRegion] = useState("");
  const [restartPolicy, setRestartPolicy] = useState("ON_FAILURE");
  const [cronSchedule, setCronSchedule] = useState("");
  const [dockerfilePath, setDockerfilePath] = useState("");
  const [sleepEnabled, setSleepEnabled] = useState(false);
  const [restartMaxRetries, setRestartMaxRetries] = useState(0);

  // Resource limits
  const [cpuLimit, setCpuLimit] = useState<number | "">("");
  const [memoryLimit, setMemoryLimit] = useState<number | "">("");

  // Volume form
  const [newVolumePath, setNewVolumePath] = useState("");

  // Logs
  const [logs, setLogs] = useState<{ message: string; severity: string; timestamp: string }[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (tab === "logs" && logs.length === 0) loadLogs(); }, [tab]);

  async function loadAll() {
    setLoading(true);
    try {
      // Service instance
      const si = await gql(t, `query($sid: String!, $eid: String!) { serviceInstance(serviceId: $sid, environmentId: $eid) { serviceName startCommand buildCommand rootDirectory healthcheckPath region numReplicas restartPolicyType restartPolicyMaxRetries cronSchedule dockerfilePath sleepApplication activeDeployments { id status createdAt } latestDeployment { id status createdAt } } }`, { sid: serviceId, eid: envId });
      const c = si.serviceInstance;
      setServiceName(c.serviceName || "");
      setConfig(c);
      setStartCmd(c.startCommand || ""); setBuildCmd(c.buildCommand || "");
      setRootDir(c.rootDirectory || ""); setHealthcheck(c.healthcheckPath || "");
      setReplicas(c.numReplicas || 1); setRegion(c.region || "");
      setRestartPolicy(c.restartPolicyType || "ON_FAILURE");
      setCronSchedule(c.cronSchedule || "");
      setDockerfilePath(c.dockerfilePath || "");
      setSleepEnabled(c.sleepApplication || false);
      setRestartMaxRetries(c.restartPolicyMaxRetries || 0);

      // Limits
      try {
        const lm = await gql(t, `query($sid: String!, $eid: String!) { serviceInstanceLimits(serviceId: $sid, environmentId: $eid) }`, { sid: serviceId, eid: envId });
        const lmData = lm.serviceInstanceLimits;
        setLimits(lmData);
        if (lmData?.containers) {
          setCpuLimit(lmData.containers.cpu || "");
          setMemoryLimit(lmData.containers.memoryBytes ? Math.round(lmData.containers.memoryBytes / 1073741824 * 10) / 10 : "");
        }
      } catch {}

      // Deployments
      const dp = await gql(t, `query($input: DeploymentListInput!, $first: Int) { deployments(input: $input, first: $first) { edges { node { id status createdAt url } } } }`,
        { input: { projectId, serviceId, environmentId: envId }, first: 20 });
      setDeployments(dp.deployments.edges.map((e: any) => e.node));

      // Variables
      const vr = await gql(t, `query($p: String!, $s: String!, $e: String!) { variables(projectId: $p, serviceId: $s, environmentId: $e) }`, { p: projectId, s: serviceId, e: envId });
      setVariables(vr.variables || {});

      // Domains
      try {
        const dm = await gql(t, `query($p: String!, $s: String!, $e: String!) { domains(projectId: $p, serviceId: $s, environmentId: $e) { serviceDomains { id domain } customDomains { id domain } } }`, { p: projectId, s: serviceId, e: envId });
        setDomains(dm.domains);
      } catch {}

    } catch (e: any) { setMsg(`Error: ${e.message}`); }
    setLoading(false);
  }

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(""), 3000); }

  async function deploy() {
    await gql(t, `mutation($sid: String!, $eid: String!) { serviceInstanceDeployV2(serviceId: $sid, environmentId: $eid) }`, { sid: serviceId, eid: envId });
    flash("Deploy triggered!"); loadAll();
  }

  async function redeploy(depId: string) {
    await gql(t, `mutation($id: String!) { deploymentRedeploy(id: $id) { id } }`, { id: depId });
    flash("Redeployed!"); loadAll();
  }

  async function removeDeploy(depId: string) {
    await gql(t, `mutation($id: String!) { deploymentRemove(id: $id) }`, { id: depId });
    flash("Removed"); loadAll();
  }

  async function saveSettings() {
    await gql(t, `mutation($sid: String!, $eid: String!, $input: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(serviceId: $sid, environmentId: $eid, input: $input) }`, {
      sid: serviceId, eid: envId, input: {
        startCommand: startCmd || null, buildCommand: buildCmd || null,
        rootDirectory: rootDir || null, healthcheckPath: healthcheck || null,
        numReplicas: replicas, region: region || null,
        restartPolicyType: restartPolicy, restartPolicyMaxRetries: restartMaxRetries,
        cronSchedule: cronSchedule || null, dockerfilePath: dockerfilePath || null,
        sleepApplication: sleepEnabled,
      }
    });
    flash("Settings saved!"); loadAll();
  }

  async function addVar() {
    if (!newKey) return;
    await gql(t, `mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`, { input: { projectId, serviceId, environmentId: envId, name: newKey, value: newVal } });
    setNewKey(""); setNewVal(""); flash(`Set ${newKey}`); loadAll();
  }

  async function deleteVar(key: string) {
    await gql(t, `mutation($input: VariableDeleteInput!) { variableDelete(input: $input) }`, { input: { projectId, serviceId, environmentId: envId, name: key } });
    flash(`Deleted ${key}`); loadAll();
  }

  async function createDomain() {
    await gql(t, `mutation($input: ServiceDomainCreateInput!) { serviceDomainCreate(input: $input) { domain } }`, { input: { serviceId, environmentId: envId } });
    flash("Domain created!"); loadAll();
  }

  async function saveResourceLimits() {
    const input: any = { serviceId, environmentId: envId };
    if (cpuLimit !== "") input.vCPUs = Number(cpuLimit);
    if (memoryLimit !== "") input.memoryGB = Number(memoryLimit);
    await gql(t, `mutation($input: ServiceInstanceLimitsUpdateInput!) { serviceInstanceLimitsUpdate(input: $input) }`, { input });
    flash("Resource limits updated!"); loadAll();
  }

  async function createVolume() {
    if (!newVolumePath) return;
    await gql(t, `mutation($input: VolumeCreateInput!) { volumeCreate(input: $input) { id name } }`, { input: { projectId, serviceId, environmentId: envId, mountPath: newVolumePath } });
    setNewVolumePath(""); flash("Volume created!"); loadAll();
  }

  async function deleteVolume(volumeId: string) {
    if (!confirm("Delete this volume? All data will be lost.")) return;
    await gql(t, `mutation($id: String!) { volumeDelete(volumeId: $id) }`, { id: volumeId });
    flash("Volume deleted"); loadAll();
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      if (deployments.length > 0) {
        // Prefer the currently building/deploying one, otherwise use latest
        const active = deployments.find(d => d.status === "BUILDING" || d.status === "DEPLOYING" || d.status === "INITIALIZING");
        const target = active || deployments[0];
        let allLogs: any[] = [];

        // Build logs
        try {
          const bl = await gql(t, `query($id: String!) { buildLogs(deploymentId: $id, limit: 200) { message severity timestamp } }`, { id: target.id });
          if (bl.buildLogs?.length) {
            allLogs = [...bl.buildLogs.map((l: any) => ({ ...l, source: "build" }))];
          }
        } catch {}

        // Runtime logs (only if deployment succeeded)
        if (target.status === "SUCCESS") {
          try {
            const dl = await gql(t, `query($id: String!) { deploymentLogs(deploymentId: $id, limit: 200) { message severity timestamp } }`, { id: target.id });
            if (dl.deploymentLogs?.length) {
              allLogs = [...allLogs, ...dl.deploymentLogs.map((l: any) => ({ ...l, source: "runtime" }))];
            }
          } catch {}
        }

        setLogs(allLogs);
      } else {
        setLogs([]);
      }
    } catch (e: any) {
      flash(`Logs error: ${e.message}`);
      setLogs([]);
    }
    setLogsLoading(false);
  }

  const tabs = ["deployments", "variables", "settings", "resources", "volumes", "domains", "logs"] as const;
  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#0f1117", border: "1px solid #374151", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none" };
  const btnStyle: React.CSSProperties = { padding: "8px 16px", background: "#7c3aed", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" };
  const btnOutline: React.CSSProperties = { ...btnStyle, background: "transparent", border: "1px solid #374151", color: "#94a3b8" };

  if (loading) return <p style={{ color: "#64748b" }}>Loading service...</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Link href={`/dashboard/project/${projectId}`} style={{ fontSize: 12, color: "#94a3b8" }}>← Back to project</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          {(() => {
            const building = deployments.find(d => d.status === "BUILDING" || d.status === "DEPLOYING" || d.status === "INITIALIZING");
            const activeDeployment = config?.activeDeployments?.[0];
            const isBuilding = !!building;
            const isRunning = !!activeDeployment && replicas > 0;
            const isStopped = replicas === 0;
            const dotColor = isBuilding ? "#f59e0b" : isRunning ? "#22c55e" : isStopped ? "#64748b" : "#ef4444";
            const statusText = isBuilding ? "Building" : isRunning ? "Running" : isStopped ? "Stopped" : "No active deploy";
            return (
              <>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, animation: isBuilding ? "pulse 1.5s infinite" : "none" }}></span>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{serviceName}</h1>
                <span style={{ fontSize: 11, color: "#64748b", background: "#1e2330", padding: "3px 8px", borderRadius: 4 }}>{statusText}</span>
                {activeDeployment && (
                  <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", background: "#0f1117", padding: "3px 8px", borderRadius: 4 }}>
                    Active: {activeDeployment.id.slice(0, 12)}
                  </span>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={deploy} style={btnStyle}>Deploy</button>
        <button onClick={() => { setReplicas(replicas > 0 ? 0 : 1); saveSettings(); }} style={btnOutline}>
          {replicas > 0 ? "⏹ Stop" : "▶ Start"}
        </button>
      </div>

      {/* Resource limits card */}
      {limits && (
        <div style={{ background: "#1e2330", border: "1px solid #2d3548", borderRadius: 10, padding: 16, marginBottom: 20, display: "flex", gap: 24 }}>
          <div><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>CPU</div><div style={{ fontSize: 16, fontWeight: 700, color: "#a78bfa" }}>{limits.containers?.cpu ? `${limits.containers.cpu} vCPU` : "Shared"}</div></div>
          <div><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Memory</div><div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>{limits.containers?.memoryBytes ? `${(limits.containers.memoryBytes / 1073741824).toFixed(1)} GB` : "Shared"}</div></div>
          <div><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Replicas</div><div style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>{replicas}</div></div>
          <div><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Region</div><div style={{ fontSize: 16, fontWeight: 700, color: "#06b6d4" }}>{region || "Auto"}</div></div>
          <div><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>PID Limit</div><div style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8" }}>{limits.containers?.pidLimit || "—"}</div></div>
        </div>
      )}

      {msg && <div style={{ background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: "8px 14px", marginBottom: 16, color: "#6ee7b7", fontSize: 13 }}>{msg}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #2d3548", marginBottom: 20 }}>
        {tabs.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)} style={{
            padding: "10px 18px", background: "none", border: "none", borderBottom: tab === tb ? "2px solid #7c3aed" : "2px solid transparent",
            color: tab === tb ? "#a78bfa" : "#64748b", fontSize: 13, fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
          }}>{tb}</button>
        ))}
      </div>

      {/* DEPLOYMENTS TAB */}
      {tab === "deployments" && (
        <div>
          {/* Active build banner */}
          {deployments.length > 0 && (deployments[0].status === "BUILDING" || deployments[0].status === "DEPLOYING" || deployments[0].status === "INITIALIZING") && (
            <div style={{ background: "#1a1a2e", border: "1px solid #7c3aed", borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1.5s infinite" }}></span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fcd34d" }}>Build in progress</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Deployment {deployments[0].id.slice(0, 16)} — Status: {deployments[0].status}</div>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>{new Date(deployments[0].createdAt).toLocaleTimeString()}</span>
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>            <thead>
              <tr style={{ borderBottom: "1px solid #2d3548" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#64748b", fontWeight: 600 }}>ID</th>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Status</th>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Created</th>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>URL</th>
                <th style={{ textAlign: "center", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #1e2330", background: config?.activeDeployments?.[0]?.id === d.id ? "#0f2a1a" : "transparent" }}>
                  <td style={{ padding: "10px 12px", fontSize: 11, fontFamily: "monospace", color: "#94a3b8" }}>
                    {d.id.slice(0, 16)}
                    {config?.activeDeployments?.[0]?.id === d.id && (
                      <span style={{ marginLeft: 8, fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#22c55e", color: "#fff", fontWeight: 700, fontFamily: "sans-serif" }}>ACTIVE</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, background: d.status === "SUCCESS" ? "#064e3b" : d.status === "FAILED" ? "#450a0a" : "#422006", color: d.status === "SUCCESS" ? "#6ee7b7" : d.status === "FAILED" ? "#fca5a5" : "#fcd34d" }}>{d.status}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#94a3b8" }}>{new Date(d.createdAt).toLocaleString()}</td>
                  <td style={{ padding: "10px 12px", fontSize: 11 }}>{d.url ? <a href={`https://${d.url}`} target="_blank" style={{ color: "#7c3aed" }}>{d.url.slice(0, 30)}</a> : "—"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <button onClick={() => redeploy(d.id)} style={{ ...btnOutline, padding: "4px 10px", fontSize: 11, marginRight: 4 }}>Redeploy</button>
                    <button onClick={() => removeDeploy(d.id)} style={{ ...btnOutline, padding: "4px 10px", fontSize: 11, color: "#f87171", borderColor: "#7f1d1d" }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deployments.length === 0 && <p style={{ color: "#64748b", textAlign: "center", padding: 40 }}>No deployments yet</p>}
        </div>
      )}

      {/* VARIABLES TAB */}
      {tab === "variables" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input placeholder="KEY" value={newKey} onChange={(e) => setNewKey(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="value" value={newVal} onChange={(e) => setNewVal(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
            <button onClick={addVar} style={btnStyle}>Set</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Object.entries(variables).map(([k, v]) => (
                <tr key={k} style={{ borderBottom: "1px solid #1e2330" }}>
                  <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: "#e2e8f0", width: "30%" }}>{k}</td>
                  <td style={{ padding: "10px 12px", fontSize: 11, fontFamily: "monospace", color: "#94a3b8", wordBreak: "break-all" }}>{String(v).slice(0, 80)}{String(v).length > 80 ? "..." : ""}</td>
                  <td style={{ padding: "10px 12px", width: 60, textAlign: "right" }}>
                    <button onClick={() => deleteVar(k)} style={{ ...btnOutline, padding: "3px 8px", fontSize: 10, color: "#f87171", borderColor: "#7f1d1d" }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.keys(variables).length === 0 && <p style={{ color: "#64748b", textAlign: "center", padding: 40 }}>No variables</p>}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === "settings" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Replicas (0 = stopped)</label>
              <input type="number" min={0} max={20} value={replicas} onChange={(e) => setReplicas(Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Start Command</label>
              <input value={startCmd} onChange={(e) => setStartCmd(e.target.value)} placeholder="e.g. node dist/index.js" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Build Command</label>
              <input value={buildCmd} onChange={(e) => setBuildCmd(e.target.value)} placeholder="e.g. npm run build" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Root Directory</label>
              <input value={rootDir} onChange={(e) => setRootDir(e.target.value)} placeholder="Leave empty for repo root" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Healthcheck Path</label>
              <input value={healthcheck} onChange={(e) => setHealthcheck(e.target.value)} placeholder="/health" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Region</label>
              <select value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle}>
                <option value="">Auto</option>
                <option value="us-west1">US West</option>
                <option value="us-east4">US East</option>
                <option value="europe-west4">Europe West</option>
                <option value="asia-southeast1">Asia Southeast</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Restart Policy</label>
              <select value={restartPolicy} onChange={(e) => setRestartPolicy(e.target.value)} style={inputStyle}>
                <option value="ON_FAILURE">On Failure</option>
                <option value="ALWAYS">Always</option>
                <option value="NEVER">Never</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Cron Schedule</label>
              <input value={cronSchedule} onChange={(e) => setCronSchedule(e.target.value)} placeholder="e.g. 0 * * * * (every hour)" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Dockerfile Path</label>
              <input value={dockerfilePath} onChange={(e) => setDockerfilePath(e.target.value)} placeholder="e.g. Dockerfile or ./docker/Dockerfile" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Restart Max Retries</label>
              <input type="number" min={0} max={10} value={restartMaxRetries} onChange={(e) => setRestartMaxRetries(Number(e.target.value))} style={inputStyle} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={sleepEnabled} onChange={(e) => setSleepEnabled(e.target.checked)} id="sleep" style={{ width: 16, height: 16 }} />
              <label htmlFor="sleep" style={{ fontSize: 13, color: "#e2e8f0" }}>Enable sleep when inactive (serverless)</label>
            </div>
            <button onClick={saveSettings} style={{ ...btnStyle, marginTop: 8 }}>Save Settings</button>
          </div>
        </div>
      )}

      {/* DOMAINS TAB */}
      {tab === "domains" && (
        <div>
          <button onClick={createDomain} style={{ ...btnStyle, marginBottom: 16 }}>+ Generate Railway Domain</button>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #2d3548" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Domain</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#64748b" }}>Type</th>
            </tr></thead>
            <tbody>
              {domains.serviceDomains?.map((d: any) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #1e2330" }}>
                  <td style={{ padding: "10px 12px" }}><a href={`https://${d.domain}`} target="_blank" style={{ color: "#7c3aed", fontSize: 13 }}>{d.domain}</a></td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#94a3b8" }}>Railway</td>
                </tr>
              ))}
              {domains.customDomains?.map((d: any) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #1e2330" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#e2e8f0" }}>{d.domain}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#94a3b8" }}>Custom</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!domains.serviceDomains?.length && !domains.customDomains?.length) && <p style={{ color: "#64748b", textAlign: "center", padding: 40 }}>No domains configured</p>}
        </div>
      )}

      {/* VOLUMES TAB */}
      {tab === "volumes" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input placeholder="Mount path (e.g. /data)" value={newVolumePath} onChange={(e) => setNewVolumePath(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={createVolume} style={btnStyle}>Create Volume</button>
          </div>
          <p style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>Volumes provide persistent storage that survives deployments and restarts.</p>
          <p style={{ color: "#475569", fontSize: 11 }}>Common paths: /data, /var/lib/postgresql/data, /var/lib/mysql</p>
        </div>
      )}

      {/* RESOURCES TAB */}
      {tab === "resources" && (
        <div style={{ maxWidth: 480 }}>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Set CPU and memory limits for this service. Leave empty for shared/auto allocation.</p>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>vCPUs</label>
              <input type="number" step="0.5" min="0.5" max="32" value={cpuLimit} onChange={(e) => setCpuLimit(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 1, 2, 4, 8" style={inputStyle} />
              <span style={{ fontSize: 11, color: "#475569", marginTop: 4, display: "block" }}>0.5 to 32 vCPUs</span>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>Memory (GB)</label>
              <input type="number" step="0.5" min="0.5" max="32" value={memoryLimit} onChange={(e) => setMemoryLimit(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 0.5, 1, 2, 4, 8" style={inputStyle} />
              <span style={{ fontSize: 11, color: "#475569", marginTop: 4, display: "block" }}>0.5 to 32 GB</span>
            </div>
            <button onClick={saveResourceLimits} style={{ ...btnStyle, marginTop: 8 }}>Save Resource Limits</button>
          </div>
        </div>
      )}

      {/* LOGS TAB */}
      {tab === "logs" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>
              {(() => {
                const active = deployments.find(d => d.status === "BUILDING" || d.status === "DEPLOYING" || d.status === "INITIALIZING");
                const target = active || deployments[0];
                return target ? `${target.id.slice(0, 12)} (${target.status}) — ${logs.length} lines` : "No deployments";
              })()}
            </span>
            <button onClick={loadLogs} style={btnOutline}>{logsLoading ? "Loading..." : "↻ Refresh Logs"}</button>
          </div>
          {logs.length === 0 && !logsLoading && (
            <div style={{ background: "#1e2330", borderRadius: 8, padding: 20, textAlign: "center" }}>
              <p style={{ color: "#64748b", fontSize: 13 }}>No logs available. Click "Refresh Logs" to fetch.</p>
            </div>
          )}
          {logs.length > 0 && (
            <div style={{ background: "#0a0c10", border: "1px solid #1e2330", borderRadius: 8, padding: 12, maxHeight: 550, overflow: "auto", fontFamily: "monospace", fontSize: 12, lineHeight: 1.7 }}>
              {logs.map((log: any, i) => {
                const sevColor = log.severity === "error" ? "#fca5a5" : log.severity === "warn" ? "#fcd34d" : "#94a3b8";
                const sourceColor = log.source === "build" ? "#7c3aed" : "#06b6d4";
                return (
                  <div key={i} style={{ display: "flex", gap: 8, borderBottom: "1px solid #1a1f2e", padding: "3px 0" }}>
                    <span style={{ color: "#475569", fontSize: 10, minWidth: 70, flexShrink: 0 }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                    </span>
                    <span style={{ color: sourceColor, fontSize: 9, minWidth: 36, flexShrink: 0, textTransform: "uppercase" }}>{log.source}</span>
                    {log.severity && <span style={{ color: sevColor, fontSize: 10, minWidth: 36, textTransform: "uppercase", flexShrink: 0 }}>{log.severity}</span>}
                    <span style={{ color: "#e2e8f0", wordBreak: "break-all" }}>{log.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
