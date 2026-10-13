"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  Divider,
} from "@mui/material";
import {
  CloudOutlined,
  CloudDoneOutlined,
  CloudOffOutlined,
  BackupOutlined,
  RestoreOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { useI18n } from "@/lib/i18n";

type DriveStatus = {
  mode?: string;
  configured: boolean;
  connected: boolean;
  email?: string | null;
  error?: string | null;
  schedule?: string;
  localIsEmpty?: boolean;
  remote?: {
    modifiedTime?: string;
    size?: string;
  } | null;
  meta?: {
    lastBackupAt?: string;
    lastRestoreAt?: string;
    lastBackupError?: string | null;
  };
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function CloudBackupPage() {
  const { t } = useI18n();
  const isDesktop = typeof window !== "undefined" && !!window.mylab?.drive;
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!window.mylab?.drive) {
      setLoading(false);
      return;
    }
    try {
      setStatus(await window.mylab.drive.getStatus());
    } catch (e: any) {
      setAlert({ type: "error", msg: e?.message || "Failed to load cloud status" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(action: () => Promise<any>, successMsg: string) {
    setBusy(true);
    setAlert(null);
    try {
      const res = await action();
      if (res?.cancelled) setAlert({ type: "info", msg: "Cancelled." });
      else if (res?.ok === false) setAlert({ type: "error", msg: res.error || "Action failed" });
      else setAlert({ type: "success", msg: successMsg });
      await refresh();
    } catch (e: any) {
      setAlert({ type: "error", msg: e?.message || "Action failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="doctor" />
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, maxWidth: 900 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <CloudOutlined color="primary" />
          <Typography variant="h5" fontWeight={700}>
            {t("nav.cloud")}
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Lab data stays on this computer. Encrypted backups go to your configured Google account every 5 minutes when online.
        </Typography>

        {alert && (
          <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
            {alert.msg}
          </Alert>
        )}

        {!isDesktop ? (
          <Alert severity="info">
            Cloud backup runs in the MyLab desktop app.
          </Alert>
        ) : loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {status?.configured && status?.connected ? (
                    <Chip icon={<CloudDoneOutlined />} label="Cloud ready" color="success" />
                  ) : status?.configured ? (
                    <Chip icon={<CloudOffOutlined />} label="Token error" color="warning" />
                  ) : (
                    <Chip icon={<CloudOffOutlined />} label="Not configured" />
                  )}
                  {status?.email && <Chip label={status.email} variant="outlined" />}
                </Stack>

                {!status?.configured && (
                  <Alert severity="warning">
                    Generate a refresh token once from your Gmail, then bake it into the app build:
                    <Box component="pre" sx={{ mt: 1, mb: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
{`GOOGLE_DRIVE_CLIENT_ID=... \\
GOOGLE_DRIVE_CLIENT_SECRET=... \\
node scripts/google-drive-get-token.js`}
                    </Box>
                    Add <code>GOOGLE_DRIVE_REFRESH_TOKEN</code> (and client id/secret) as GitHub env vars, then rebuild.
                  </Alert>
                )}

                <Typography variant="body2" color="text.secondary">
                  Schedule: {status?.schedule}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last backup: {fmt(status?.meta?.lastBackupAt)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cloud copy: {status?.remote?.modifiedTime ? fmt(status.remote.modifiedTime) : "None yet"}
                </Typography>
                {status?.meta?.lastBackupError && (
                  <Alert severity="error">Last backup error: {status.meta.lastBackupError}</Alert>
                )}
                {status?.error && <Alert severity="error">{status.error}</Alert>}

                <Divider />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    variant="contained"
                    startIcon={<BackupOutlined />}
                    disabled={busy || !status?.configured}
                    onClick={() =>
                      run(() => window.mylab!.drive!.backupNow(), "Backup uploaded to Google Drive.")
                    }
                  >
                    Backup now
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RestoreOutlined />}
                    disabled={busy || !status?.configured || !status?.remote}
                    onClick={() =>
                      run(() => window.mylab!.drive!.restore(), "Backup restored from Google Drive.")
                    }
                  >
                    Restore
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}
