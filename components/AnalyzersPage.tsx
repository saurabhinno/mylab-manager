"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CableOutlined,
  PlayArrowOutlined,
  StopOutlined,
  InboxOutlined,
  ClearOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { reportDisplayNumber } from "@/lib/reportNumber";

type InboxRow = {
  id: number;
  machine_path: string | null;
  sample_id: string | null;
  patient_name: string | null;
  status: string;
  received_at: string;
  parsed_json: string;
};

type PendingReport = {
  id: number;
  daily_number?: number | null;
  patient_name: string;
  date: string;
  status: string;
};

type AnalyzerProfileInfo = {
  id: string;
  label: string;
  defaultBaud: number;
  protocolHint: string;
};

function ts() {
  return new Date().toLocaleTimeString();
}

export default function AnalyzersPage({
  role,
}: {
  role: "doctor" | "compounder";
}) {
  const { t } = useI18n();
  const isDesktop = typeof window !== "undefined" && !!window.mylab?.analyzers;
  const [profileId, setProfileId] = useState("cellenium-21");
  const [profiles, setProfiles] = useState<AnalyzerProfileInfo[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [pending, setPending] = useState<PendingReport[]>([]);
  const [applyReportId, setApplyReportId] = useState<Record<number, string>>({});
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [lanListening, setLanListening] = useState(false);
  const [lanPort, setLanPort] = useState(5100);
  const [machineIp, setMachineIp] = useState("192.168.10.2");
  const [lanAddresses, setLanAddresses] = useState<{ name: string; address: string }[]>([]);
  const [lanClients, setLanClients] = useState(0);
  const [lastRemote, setLastRemote] = useState<string | null>(null);
  const rawAcc = useRef("");
  const profileIdRef = useRef(profileId);
  const logEndRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    profileIdRef.current = profileId;
  }, [profileId]);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === profileId) || null,
    [profiles, profileId]
  );

  const appendLog = useCallback((line: string) => {
    setLogLines((prev) => [...prev.slice(-800), `[${ts()}] ${line}`]);
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logLines]);

  const refreshInbox = useCallback(async () => {
    try {
      const [inboxRes, pendRes, profRes] = await Promise.all([
        apiRequest("/api/analyzers/inbox?status=new"),
        apiRequest("/api/analyzers/pending-reports"),
        apiRequest("/api/analyzers/profiles"),
      ]);
      if (inboxRes.ok) setInbox(await inboxRes.json());
      if (pendRes.ok) setPending(await pendRes.json());
      if (profRes.ok) {
        const list = (await profRes.json()) as AnalyzerProfileInfo[];
        setProfiles(list);
        const cellenium = list.find((p) => p.id === "cellenium-21");
        if (cellenium) setProfileId(cellenium.id);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshLanStatus = useCallback(async () => {
    if (!window.mylab?.analyzers) return;
    try {
      const st = await window.mylab.analyzers.getStatus();
      if (st?.lan) {
        setLanListening(!!st.lan.listening);
        setLanPort(st.lan.port || st.lan.defaultPort || 5100);
        setLanAddresses(st.lan.addresses || []);
        setLanClients(st.lan.clients || 0);
        appendLog(
          `Status · LAN ${st.lan.listening ? "LISTENING" : "stopped"} port=${st.lan.port} clients=${st.lan.clients || 0} ips=${(st.lan.addresses || []).map((a) => a.address).join(",") || "none"}`
        );
      }
    } catch (e: any) {
      appendLog(`Status error: ${e?.message || e}`);
    }
  }, [appendLog]);

  useEffect(() => {
    refreshInbox();
  }, [refreshInbox]);

  const saveRawToInbox = useCallback(
    async (raw: string, machinePath: string | null) => {
      if (!raw.trim()) return;
      try {
        appendLog(`Saving message (${raw.length} chars) from ${machinePath || "lan"}…`);
        const saveRes = await apiRequest("/api/analyzers/inbox", {
          method: "POST",
          body: JSON.stringify({
            raw,
            machine_path: machinePath,
            profile_id: profileIdRef.current,
          }),
        });
        const saved = await saveRes.json();
        if (!saveRes.ok) {
          appendLog(`Save FAILED: ${saved.error || saveRes.status}`);
          setAlert({ type: "error", msg: saved.error || "Save failed" });
          return;
        }
        const parseRes = await apiRequest("/api/analyzers/parse", {
          method: "POST",
          body: JSON.stringify({ raw, profile_id: profileIdRef.current }),
        });
        if (parseRes.ok) {
          const parsed = await parseRes.json();
          setParsedPreview(parsed);
          appendLog(
            `Parsed format=${parsed.format || "?"} sample=${parsed.parsed?.sampleId || "—"} results=${parsed.mapped?.length || 0}`
          );
          for (const m of parsed.mapped || []) {
            appendLog(
              `  ${m.code} → ${m.testName || "(unmapped)"} = ${m.value}${m.unit ? " " + m.unit : ""}`
            );
          }
        }
        if (saved.attached && saved.report_id) {
          const shown =
            saved.daily_number || saved.report_id;
          appendLog(
            `Attached to report #${shown} · ${saved.patient_name || "patient"} · applied ${saved.applied ?? "?"}`
          );
          setAlert({
            type: "success",
            msg: `Results attached to report #${shown}`,
          });
          window.dispatchEvent(
            new CustomEvent("mylab:report-created", {
              detail: { reportId: saved.report_id, patientName: saved.patient_name },
            })
          );
        } else {
          setAlert({
            type: "success",
            msg: `Saved machine message to inbox (#${saved.id})`,
          });
          appendLog(`Saved inbox #${saved.id}`);
        }
        await refreshInbox();
      } catch (e: any) {
        appendLog(`Save error: ${e?.message || e}`);
        setAlert({ type: "error", msg: e?.message || "Save failed" });
      }
    },
    [appendLog, refreshInbox]
  );

  useEffect(() => {
    if (!isDesktop || !window.mylab?.analyzers) return;
    refreshLanStatus();
    appendLog("Analyzers page ready (LAN mode only)");

    // Ensure listen is up (Electron also auto-starts; this covers page-only refresh).
    void (async () => {
      try {
        const st = await window.mylab!.analyzers!.getStatus();
        if (!st?.lan?.listening) {
          appendLog(`Auto-starting LAN listen on port ${lanPort}…`);
          const res = await window.mylab!.analyzers!.startLan(lanPort);
          if (res?.ok === false) appendLog(`Auto-start FAILED: ${res.error}`);
        } else {
          appendLog(`LAN already listening on port ${st.lan.port}`);
        }
      } catch (e: any) {
        appendLog(`Auto-start error: ${e?.message || e}`);
      }
    })();

    const offRaw = window.mylab.analyzers.onRaw?.((payload) => {
      const preview = payload.chunk.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
      appendLog(`RAW ${payload.path}: ${preview.slice(0, 200)}${preview.length > 200 ? "…" : ""}`);
      rawAcc.current += payload.chunk;
      setRawText(rawAcc.current);
    });

    // Inbox save is handled by AnalyzerLanBridge after login (avoids duplicates).
    const offMessage = window.mylab.analyzers.onMessage?.((payload) => {
      appendLog(`MESSAGE complete from ${payload.path} (${payload.raw.length} bytes)`);
      rawAcc.current = payload.raw;
      setRawText(payload.raw);
      setLastRemote(payload.path);
      // Bridge saves async — brief delay then refresh inbox list.
      window.setTimeout(() => {
        void refreshInbox();
      }, 400);
    });

    const offLan = window.mylab.analyzers.onLan?.((p) => {
      setLanListening(!!p.listening);
      setLanPort(p.port);
      setLanAddresses(p.addresses || []);
      appendLog(
        `LAN ${p.listening ? "STARTED" : "STOPPED"} port=${p.port} ips=${(p.addresses || []).map((a) => a.address).join(",") || "none"}`
      );
    });

    const offLanClient = window.mylab.analyzers.onLanClient?.((p) => {
      setLanClients(p.clients);
      appendLog(`CLIENT ${p.event}: ${p.remote} (clients=${p.clients})`);
      if (p.event === "connect") {
        setLastRemote(p.remote);
        setAlert({ type: "info", msg: `Analyzer connected: ${p.remote}` });
      }
    });

    const offError = window.mylab.analyzers.onError((p) => {
      appendLog(`ERROR ${p.path}: ${p.error}`);
      setAlert({ type: "error", msg: p.error || "LAN error" });
    });

    return () => {
      offRaw?.();
      offMessage?.();
      offLan?.();
      offLanClient?.();
      offError();
    };
  }, [isDesktop, refreshLanStatus, appendLog, saveRawToInbox]);

  async function startLanListen() {
    if (!window.mylab?.analyzers?.startLan) return;
    setBusy(true);
    setAlert(null);
    appendLog(`Starting LAN listen on 0.0.0.0:${lanPort}…`);
    try {
      const res = await window.mylab.analyzers.startLan(lanPort);
      if (res?.ok === false) {
        appendLog(`Start FAILED: ${res.error}`);
        setAlert({ type: "error", msg: res.error || "Could not start LAN listener" });
      } else {
        setLanListening(true);
        setLanPort(res.port || lanPort);
        setLanAddresses(res.addresses || []);
        const ips = (res.addresses || []).map((a) => a.address).join(", ");
        appendLog(`Listening OK · port=${res.port || lanPort} · PC IPs: ${ips || "(none — check Ethernet/Wi‑Fi)"}`);
        setAlert({
          type: "success",
          msg: `LAN listening on port ${res.port || lanPort}${ips ? ` · PC IP: ${ips}` : ""}`,
        });
      }
    } catch (e: any) {
      appendLog(`Start exception: ${e?.message || e}`);
      setAlert({ type: "error", msg: e?.message || "LAN start failed" });
    } finally {
      setBusy(false);
    }
  }

  async function stopLanListen() {
    if (!window.mylab?.analyzers?.stopLan) return;
    setBusy(true);
    appendLog("Stopping LAN listen…");
    try {
      await window.mylab.analyzers.stopLan();
      setLanListening(false);
      setLanClients(0);
      appendLog("LAN stopped");
    } finally {
      setBusy(false);
    }
  }

  async function probeMachine() {
    if (!window.mylab?.analyzers?.probeHost) return;
    setBusy(true);
    setAlert(null);
    appendLog(`Probing machine ${machineIp}…`);
    try {
      const res = await window.mylab.analyzers.probeHost(machineIp, [
        lanPort,
        2575,
        5000,
        22,
      ]);
      if (res?.ok === false) {
        appendLog(`Probe FAILED: ${res.error}`);
        setAlert({ type: "error", msg: res.error || "Probe failed" });
      } else {
        appendLog(
          `Probe · openPorts=[${(res.openPorts || []).join(",") || "none"}] · ourListen=${res.ourListen?.listening ? "yes" : "no"} :${res.ourListen?.port}`
        );
        appendLog(res.hint || "—");
        setAlert({
          type: (res.openPorts || []).includes(lanPort) ? "success" : "info",
          msg: res.hint || "Probe complete",
        });
      }
    } catch (e: any) {
      appendLog(`Probe exception: ${e?.message || e}`);
      setAlert({ type: "error", msg: e?.message || "Probe failed" });
    } finally {
      setBusy(false);
    }
  }

  async function connectToMachine() {
    if (!window.mylab?.analyzers?.connectLan) return;
    const host = machineIp.trim();
    const ownIps = new Set([
      "127.0.0.1",
      "localhost",
      ...lanAddresses.map((a) => a.address),
    ]);
    if (ownIps.has(host)) {
      appendLog(
        `Connect blocked: ${host} is this PC. Use Machine IP 192.168.10.2 (analyzer), not Server IP ${host}.`
      );
      setAlert({
        type: "error",
        msg: "Machine IP must be the analyzer (e.g. 192.168.10.2), not this PC. Cellenium Net mode: keep LAN listen on and Transmit from the machine.",
      });
      return;
    }
    setBusy(true);
    setAlert(null);
    appendLog(`Connecting OUT to ${host}:${lanPort}…`);
    try {
      const res = await window.mylab.analyzers.connectLan(host, lanPort);
      if (res?.ok === false) {
        appendLog(`Connect FAILED: ${res.error}`);
        setAlert({ type: "error", msg: res.error || "Connect failed" });
      } else {
        appendLog(`Connected to ${res.host}:${res.port} — waiting for data…`);
        setAlert({
          type: "success",
          msg: `Connected to ${host}:${lanPort}. If no data appears, use LAN listen (Cellenium pushes to PC).`,
        });
      }
    } catch (e: any) {
      appendLog(`Connect exception: ${e?.message || e}`);
      setAlert({ type: "error", msg: e?.message || "Connect failed" });
    } finally {
      setBusy(false);
    }
  }

  async function parseAndSave() {
    const raw = rawAcc.current || rawText;
    if (!raw.trim()) {
      setAlert({ type: "info", msg: "No data captured yet. Run a sample on the machine." });
      return;
    }
    setBusy(true);
    await saveRawToInbox(raw, lastRemote || `lan://:${lanPort}`);
    setBusy(false);
  }

  async function applyInbox(id: number) {
    const report_id = applyReportId[id] ? Number(applyReportId[id]) : undefined;
    setBusy(true);
    try {
      appendLog(`Applying inbox #${id} → report ${report_id || "(sample id)"}`);
      const res = await apiRequest(`/api/analyzers/inbox/${id}/apply`, {
        method: "POST",
        body: JSON.stringify({ report_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        appendLog(`Apply FAILED: ${data.error}`);
        setAlert({ type: "error", msg: data.error || "Apply failed" });
      } else {
        const shown = data.daily_number || data.report_id;
        appendLog(`Applied ${data.applied} values to report #${shown}`);
        setAlert({
          type: "success",
          msg: `Applied ${data.applied} values to report #${shown}`,
        });
        await refreshInbox();
      }
    } catch (e: any) {
      appendLog(`Apply error: ${e?.message || e}`);
      setAlert({ type: "error", msg: e?.message || "Apply failed" });
    } finally {
      setBusy(false);
    }
  }

  async function createCbcFromInbox(id: number, patientName?: string | null) {
    setBusy(true);
    try {
      appendLog(`Creating CBC report from inbox #${id}…`);
      const res = await apiRequest(`/api/analyzers/inbox/${id}/create-report`, {
        method: "POST",
        body: JSON.stringify({
          patient_name: patientName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        appendLog(`Create CBC FAILED: ${data.error}`);
        setAlert({ type: "error", msg: data.error || "Create report failed" });
      } else {
        const shown = data.daily_number || data.report_id;
        appendLog(
          `Created report #${shown} for ${data.patient_name} · applied ${data.applied}/${data.mapped_count} CBC values`
        );
        setAlert({
          type: "success",
          msg: `CBC report #${shown} created with ${data.applied} values filled`,
        });
        await refreshInbox();
        const base = role === "compounder" ? "/compounder/reports" : "/doctor/reports";
        window.location.href = `${base}/${data.report_id}`;
      }
    } catch (e: any) {
      appendLog(`Create CBC error: ${e?.message || e}`);
      setAlert({ type: "error", msg: e?.message || "Create report failed" });
    } finally {
      setBusy(false);
    }
  }

  async function ignoreInbox(id: number) {
    await apiRequest(`/api/analyzers/inbox/${id}/ignore`, { method: "POST" });
    appendLog(`Ignored inbox #${id}`);
    await refreshInbox();
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role={role} />
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, maxWidth: 1100 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <CableOutlined color="primary" />
          <Typography variant="h5" fontWeight={700}>
            {t("nav.analyzers")}
          </Typography>
          <Chip size="small" label="LAN only" color="primary" variant="outlined" />
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Cellenium Net/LAN mode: MyLab listens on TCP, machine sends HL7 results to this PC.
        </Typography>

        {alert && (
          <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
            {alert.msg}
          </Alert>
        )}

        {!isDesktop ? (
          <Alert severity="info">LAN analyzer receive runs in the MyLab desktop app.</Alert>
        ) : (
          <Stack spacing={3}>
            <Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ sm: "center" }}
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Typography variant="h6" fontWeight={700}>
                  LAN listen
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <TextField
                    select
                    size="small"
                    label="Machine"
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    sx={{ minWidth: 160 }}
                  >
                    {profiles.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Port"
                    type="number"
                    value={lanPort}
                    onChange={(e) => setLanPort(Number(e.target.value) || 5100)}
                    sx={{ width: 110 }}
                    disabled={lanListening}
                  />
                  <TextField
                    size="small"
                    label="Machine IP"
                    value={machineIp}
                    onChange={(e) => setMachineIp(e.target.value.trim())}
                    sx={{ width: 140 }}
                  />
                  {lanListening ? (
                    <Button
                      size="small"
                      color="warning"
                      startIcon={<StopOutlined />}
                      disabled={busy}
                      onClick={stopLanListen}
                    >
                      Stop
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<PlayArrowOutlined />}
                      disabled={busy}
                      onClick={startLanListen}
                    >
                      Start LAN listen
                    </Button>
                  )}
                  <Button size="small" variant="outlined" disabled={busy} onClick={probeMachine}>
                    Probe machine
                  </Button>
                  {/* Cellenium Net is push-only (machine → PC). Outbound connect always fails. */}
                  {profileId !== "cellenium-21" && (
                    <Button size="small" variant="outlined" disabled={busy} onClick={connectToMachine}>
                      Connect to machine
                    </Button>
                  )}
                  <Button size="small" disabled={busy} onClick={refreshLanStatus}>
                    Refresh status
                  </Button>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                <Chip
                  size="small"
                  color={lanListening ? "success" : "default"}
                  label={lanListening ? `Listening :${lanPort}` : "Stopped"}
                />
                <Chip size="small" label={`Clients: ${lanClients}`} />
                {lastRemote && <Chip size="small" variant="outlined" label={`Last: ${lastRemote}`} />}
                {(lanAddresses.length ? lanAddresses : []).map((a) => (
                  <Chip
                    key={a.address + a.name}
                    size="small"
                    variant="outlined"
                    label={`PC ${a.address}`}
                  />
                ))}
              </Stack>

              {lanListening ? (
                <Alert severity="success" sx={{ mb: 1 }}>
                  Listening — waiting for the analyzer to connect. On Cellenium:{" "}
                  <strong>Trans = Net</strong>, <strong>Server IP = 192.168.10.1</strong>,{" "}
                  <strong>Port = {lanPort}</strong>, <strong>HL7</strong>, then Transmit.{" "}
                  <em>Clients: 0</em> is normal until the machine dials in (do not use Connect —
                  Cellenium pushes to MyLab).
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 1 }}>
                  {activeProfile?.protocolHint ||
                    "Start LAN listen, then point the analyzer Server IP at this PC."}
                </Alert>
              )}
            </Box>

            <Divider />

            <Box>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="h6" fontWeight={700}>
                  Details / output
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    startIcon={<ClearOutlined />}
                    onClick={() => {
                      setLogLines([]);
                      rawAcc.current = "";
                      setRawText("");
                      setParsedPreview(null);
                      appendLog("Log cleared");
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={busy || !rawText.trim()}
                    onClick={parseAndSave}
                  >
                    Parse & save
                  </Button>
                </Stack>
              </Stack>
              <Box
                ref={logEndRef}
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  bgcolor: "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 12,
                  minHeight: 220,
                  maxHeight: 360,
                  overflow: "auto",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {logLines.length ? logLines.join("\n") : "— start LAN listen, then run a sample —"}
              </Box>
              {rawText.trim() && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Last raw payload ({rawText.length} chars)
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1.5,
                      bgcolor: "#111827",
                      color: "#a7f3d0",
                      fontSize: 11,
                      maxHeight: 160,
                      overflow: "auto",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {rawText}
                  </Box>
                </Box>
              )}
              {parsedPreview?.mapped && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Mapped results
                    {parsedPreview.format ? ` · ${parsedPreview.format}` : ""}
                    {parsedPreview.parsed?.sampleId
                      ? ` · sample ${parsedPreview.parsed.sampleId}`
                      : ""}
                  </Typography>
                  <Stack spacing={0.5}>
                    {parsedPreview.mapped.map((m: any, i: number) => (
                      <Typography key={i} variant="body2">
                        {m.code} → {m.testName || "(unmapped)"} = {m.value}
                        {m.unit ? ` ${m.unit}` : ""}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>

            <Divider />

            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <InboxOutlined color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Inbox
                </Typography>
                <Button size="small" onClick={refreshInbox}>
                  Refresh
                </Button>
              </Stack>
              <Alert severity="info" sx={{ mb: 1.5 }}>
                Machine results auto-create a <strong>CBC report</strong> (patient name + values)
                and show under Reports for edit/print. Inbox only keeps items that failed
                auto-create.
              </Alert>
              {inbox.length === 0 ? (
                <Typography color="text.secondary">
                  No pending inbox items — new transmits create reports automatically.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {inbox.map((row) => {
                    let mapped: any[] = [];
                    let format = "";
                    try {
                      const j = JSON.parse(row.parsed_json);
                      mapped = j?.mapped || [];
                      format = j?.format || "";
                    } catch {
                      /* ignore */
                    }
                    return (
                      <Box
                        key={row.id}
                        sx={{ border: "1px solid", borderColor: "divider", p: 2 }}
                      >
                        <Typography fontWeight={600}>
                          #{row.id}
                          {row.sample_id ? ` · sample ${row.sample_id}` : ""}
                          {row.patient_name ? ` · ${row.patient_name}` : ""}
                          {format ? ` · ${format}` : ""}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(row.received_at).toLocaleString()}
                          {row.machine_path ? ` · ${row.machine_path}` : ""}
                          {` · ${mapped.length} results`}
                        </Typography>
                        {mapped.length > 0 && (
                          <Box
                            component="pre"
                            sx={{
                              mt: 1,
                              mb: 0,
                              p: 1,
                              bgcolor: "action.hover",
                              fontSize: 11,
                              maxHeight: 100,
                              overflow: "auto",
                            }}
                          >
                            {mapped
                              .map(
                                (m: any) =>
                                  `${m.code}=${m.value}${m.unit ? " " + m.unit : ""} → ${m.testName || "?"}`
                              )
                              .join("\n")}
                          </Box>
                        )}
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          sx={{ mt: 1.5 }}
                          alignItems={{ sm: "center" }}
                        >
                          <TextField
                            select
                            size="small"
                            label="Apply to report"
                            value={applyReportId[row.id] || ""}
                            onChange={(e) =>
                              setApplyReportId((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                            sx={{ minWidth: 260 }}
                          >
                            <MenuItem value="">
                              {row.sample_id && /^\d+$/.test(row.sample_id)
                                ? `Use sample id #${row.sample_id}`
                                : "Select report"}
                            </MenuItem>
                            {pending.map((r) => (
                              <MenuItem key={r.id} value={String(r.id)}>
                                #{reportDisplayNumber(r)} · {r.patient_name} · {r.date}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Button
                            variant="contained"
                            size="small"
                            disabled={busy}
                            onClick={() => createCbcFromInbox(row.id, row.patient_name)}
                          >
                            Create CBC report
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            disabled={busy}
                            onClick={() => applyInbox(row.id)}
                          >
                            Apply to existing
                          </Button>
                          <Button size="small" disabled={busy} onClick={() => ignoreInbox(row.id)}>
                            Ignore
                          </Button>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Stack>
        )}

        {busy && (
          <Box sx={{ position: "fixed", bottom: 24, right: 24 }}>
            <CircularProgress size={28} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
