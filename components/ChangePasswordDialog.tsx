"use client";

import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert, InputAdornment, IconButton, Box, Typography,
} from "@mui/material";
import {
  LockOutlined, VisibilityOutlined, VisibilityOffOutlined, CloseOutlined,
} from "@mui/icons-material";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShow(false);
    setError(null);
    setSuccess(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword.length < 4) {
      setError(t("password.too_short"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("password.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest("/api/auth/me/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("password.change_failed"));
        return;
      }
      setSuccess(t("password.change_success"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(handleClose, 1200);
    } finally {
      setBusy(false);
    }
  }

  const pwAdornment = (
    <InputAdornment position="end">
      <IconButton size="small" onClick={() => setShow(!show)}>
        {show ? <VisibilityOffOutlined sx={{ fontSize: 18 }} /> : <VisibilityOutlined sx={{ fontSize: 18 }} />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LockOutlined color="primary" />
          <Typography variant="h6">{t("password.change_title")}</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}><CloseOutlined /></IconButton>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        <Box component="form" id="change-pw-form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label={t("password.current")}
            type={show ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            fullWidth
            autoFocus
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockOutlined sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment>,
              endAdornment: pwAdornment,
            }}
          />
          <TextField
            label={t("password.new")}
            type={show ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            fullWidth
            inputProps={{ minLength: 4 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockOutlined sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment>,
            }}
          />
          <TextField
            label={t("password.confirm")}
            type={show ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockOutlined sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment>,
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} variant="outlined">{t("common.cancel")}</Button>
        <Button type="submit" form="change-pw-form" variant="contained" disabled={busy}>
          {busy ? t("common.loading") : t("password.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
