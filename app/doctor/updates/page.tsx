"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  LinearProgress,
  Stack,
  Chip,
} from "@mui/material";
import {
  SystemUpdateAltOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  RestartAltOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { useI18n } from "@/lib/i18n";

type UpdateStatus = MylabUpdateStatus;

function fmtBytes(n: number) {
  if (!n || n <= 0) return "";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UpdatesPage() {
  const { t } = useI18n();
  const isDesktop = typeof window !== "undefined" && !!window.mylab?.updates;
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!window.mylab?.updates?.getStatus) return;
    try {
      setStatus(await window.mylab.updates.getStatus());
    } catch (e: any) {
      setAlert({ type: "error", msg: e?.message || "Failed to load update status" });
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!window.mylab?.updates?.onStatus) return;
    return window.mylab.updates.onStatus((s) => setStatus(s));
  }, [refresh]);

  async function handleCheck() {
    if (!window.mylab?.updates?.check) return;
    setBusy(true);
    setAlert(null);
    try {
      const s = await window.mylab.updates.check();
      setStatus(s);
      if (s.status === "latest") setAlert({ type: "success", msg: t("updates.up_to_date") });
      else if (s.status === "error") setAlert({ type: "error", msg: s.error || t("updates.check_failed") });
    } catch (e: any) {
      setAlert({ type: "error", msg: e?.message || t("updates.check_failed") });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!window.mylab?.updates?.download) return;
    setBusy(true);
    setAlert(null);
    try {
      const s = await window.mylab.updates.download();
      setStatus(s);
      if (s.status === "error") setAlert({ type: "error", msg: s.error || t("updates.download_failed") });
    } catch (e: any) {
      setAlert({ type: "error", msg: e?.message || t("updates.download_failed") });
    } finally {
      setBusy(false);
    }
  }

  async function handleInstall() {
    if (!window.mylab?.updates?.install) return;
    setBusy(true);
    setAlert({ type: "info", msg: t("updates.restarting") });
    try {
      const res = await window.mylab.updates.install();
      if (res?.ok === false) {
        setAlert({ type: "error", msg: res.error || t("updates.install_failed") });
        setBusy(false);
      }
      // On success the app should quit and relaunch; keep busy state.
    } catch (e: any) {
      setAlert({ type: "error", msg: e?.message || t("updates.install_failed") });
      setBusy(false);
    }
  }

  const s = status?.status || "idle";
  const percent = Math.round(status?.percent || 0);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="doctor" />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }} id="main-content" tabIndex={-1}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t("updates.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("updates.subtitle")}
          </Typography>
        </Box>

        {!isDesktop ? (
          <Alert severity="info">{t("updates.desktop_only")}</Alert>
        ) : (
          <Card sx={{ maxWidth: 560, borderRadius: 2 }}>
            <CardContent>
              <Stack spacing={2}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <SystemUpdateAltOutlined color="primary" />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      MyLab {status?.currentVersion || "…"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {status?.message || t("updates.ready_to_check")}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Chip size="small" label={`${t("updates.current")}: ${status?.currentVersion || "—"}`} />
                  {status?.latestVersion && (
                    <Chip
                      size="small"
                      color={s === "latest" ? "success" : "primary"}
                      label={`${t("updates.latest")}: ${status.latestVersion}`}
                    />
                  )}
                  {s === "ready" && <Chip size="small" color="success" icon={<CheckCircleOutlined />} label={t("updates.downloaded")} />}
                </Box>

                {s === "downloading" && (
                  <Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("updates.downloading")}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {percent}%
                        {status?.total
                          ? ` · ${fmtBytes(status.transferred)} / ${fmtBytes(status.total)}`
                          : ""}
                      </Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={percent} sx={{ height: 8, borderRadius: 4 }} />
                  </Box>
                )}

                {s === "checking" && <LinearProgress sx={{ height: 6, borderRadius: 3 }} />}

                {alert && (
                  <Alert severity={alert.type} onClose={() => setAlert(null)}>
                    {alert.msg}
                  </Alert>
                )}

                {status?.error && s === "error" && (
                  <Alert severity="error">{status.error}</Alert>
                )}

                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", pt: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={handleCheck}
                    disabled={busy || s === "checking" || s === "downloading"}
                    startIcon={<SystemUpdateAltOutlined />}
                  >
                    {t("nav.check_update")}
                  </Button>

                  {(s === "available" || (s === "error" && status?.latestVersion)) && (
                    <Button
                      variant="contained"
                      onClick={handleDownload}
                      disabled={busy}
                      startIcon={<DownloadOutlined />}
                    >
                      {`${t("updates.update_btn")} ${status?.latestVersion || ""}`}
                    </Button>
                  )}

                  {s === "ready" && (
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleInstall}
                      disabled={busy}
                      startIcon={<RestartAltOutlined />}
                    >
                      {t("updates.restart_install")}
                    </Button>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}
