"use client";

import { useEffect, useState, useRef } from "react";
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Alert, Grid, Avatar, Divider, CircularProgress,
} from "@mui/material";
import { SaveOutlined, ImageOutlined, SettingsOutlined, DeleteOutlined } from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useI18n();
  const [labName, setLabName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiRequest("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setLabName(d.lab_name || "");
          setAddress(d.address || "");
          setPhone(d.phone || "");
          setEmail(d.email || "");
          setHeaderText(d.header_text || "");
          setFooterText(d.footer_text || "");
          if (d.logo_path) setLogoPreview(d.logo_path);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setLogoPreview(reader.result as string); setLogoFile(reader.result as string); };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body: any = { lab_name: labName, address, phone, email, header_text: headerText, footer_text: footerText };
    if (logoFile) body.logo_image = logoFile;
    else if (!logoPreview) body.logo_image = null;

    const res = await apiRequest("/api/settings", { method: "PUT", body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      if (data.logo_path) setLogoPreview(data.logo_path);
      setLogoFile(null);
      setAlert({ type: "success", msg: "Settings saved." });
    } else {
      setAlert({ type: "error", msg: "Failed to save settings." });
    }
    setTimeout(() => setAlert(null), 4000);
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <Sidebar role="doctor" email="doctor@mylab.com" />
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress /></Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="doctor" email="doctor@mylab.com" />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }} id="main-content" tabIndex={-1}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5">{t("settings.title")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("settings.subtitle")}</Typography>
        </Box>

        {alert && <Alert severity={alert.type} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

        <Box component="form" onSubmit={handleSave}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <SettingsOutlined sx={{ color: "primary.main" }} />
                    <Typography variant="h6">{t("settings.lab_info")}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <TextField label={t("settings.lab_name")} value={labName} onChange={(e) => setLabName(e.target.value)} required fullWidth />
                    <TextField label={t("settings.address")} value={address} onChange={(e) => setAddress(e.target.value)} fullWidth multiline rows={2} />
                    <Grid container spacing={1.5}>
                      <Grid item xs={6}><TextField label={t("settings.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth /></Grid>
                      <Grid item xs={6}><TextField label={t("settings.email")} value={email} onChange={(e) => setEmail(e.target.value)} fullWidth /></Grid>
                    </Grid>
                    <TextField label={t("settings.header_tagline")} value={headerText} onChange={(e) => setHeaderText(e.target.value)} fullWidth placeholder={t("settings.header_placeholder")} helperText={t("settings.header_helper")} />
                    <TextField label={t("settings.footer_label")} value={footerText} onChange={(e) => setFooterText(e.target.value)} fullWidth multiline rows={2} helperText={t("settings.footer_helper")} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <ImageOutlined sx={{ color: "primary.main" }} />
                    <Typography variant="h6">{t("settings.lab_logo")}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t("settings.logo_desc")}
                  </Typography>
                  <Box sx={{
                    border: "2px dashed", borderColor: logoPreview ? "primary.main" : "divider",
                    borderRadius: 2, p: 3, textAlign: "center", bgcolor: logoPreview ? "#f8fafc" : "transparent",
                    mb: 2, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {logoPreview ? (
                      <Box component="img" src={logoPreview} alt="Logo" sx={{ maxWidth: "100%", maxHeight: 100, objectFit: "contain" }} />
                    ) : (
                      <Avatar sx={{ width: 48, height: 48, bgcolor: "#e8f0fe", color: "#0f4c81" }}><ImageOutlined /></Avatar>
                    )}
                  </Box>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleLogoChange} />
                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    <Button variant="outlined" startIcon={<ImageOutlined />} onClick={() => fileRef.current?.click()}>
                      {logoPreview ? t("settings.change_logo") : t("settings.upload_logo")}
                    </Button>
                    {logoPreview && (
                      <Button variant="outlined" color="error" startIcon={<DeleteOutlined />} onClick={() => { setLogoPreview(null); setLogoFile(null); }}>
                        {t("settings.remove")}
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>

              <Box sx={{ mt: 3 }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined />}
                  disabled={saving}
                >
                  {saving ? t("settings.saving") : t("settings.save")}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}
