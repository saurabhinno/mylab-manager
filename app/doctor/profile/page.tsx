"use client";

import { useEffect, useState, useRef } from "react";
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Alert, Grid, Avatar, Divider, CircularProgress,
} from "@mui/material";
import {
  SaveOutlined, ImageOutlined, PersonOutlined, DeleteOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/useUser";

export default function ProfilePage() {
  const { t } = useI18n();
  const { user: me, loading: meLoading } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<string | null>(null); // base64 for upload
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const userId = me?.id;

  useEffect(() => {
    if (!userId) {
      if (!meLoading) setLoading(false);
      return;
    }
    apiRequest(`/api/auth/profile/${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setName(d.name || "");
          setEmail(d.email || "");
          if (d.signature_image) {
            setSignaturePath(d.signature_image);
            setSignaturePreview(d.signature_image);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId, meLoading]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setAlert({ type: "error", msg: "File too large. Max 2MB." });
      setTimeout(() => setAlert(null), 4000);
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setSignaturePreview(base64);
      setSignatureFile(base64);
      if (!userId) return;
      // Auto-save signature immediately
      setSaving(true);
      const res = await apiRequest(`/api/auth/profile/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ name, signature_image: base64 }),
      });
      setSaving(false);
      if (res.ok) {
        const data = await res.json();
        if (data.user?.signature_image) {
          setSignaturePath(data.user.signature_image);
          setSignaturePreview(data.user.signature_image);
        }
        setSignatureFile(null);
        setAlert({ type: "success", msg: "Signature saved." });
      } else {
        setAlert({ type: "error", msg: "Failed to save signature." });
      }
      setTimeout(() => setAlert(null), 3000);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const body: any = { name };
    if (signatureFile) {
      body.signature_image = signatureFile; // new upload as base64
    } else if (!signaturePreview && signaturePath) {
      body.signature_image = null; // user removed signature
    }
    const res = await apiRequest(`/api/auth/profile/${userId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      if (data.user?.signature_image) {
        setSignaturePath(data.user.signature_image);
        setSignaturePreview(data.user.signature_image);
      } else {
        setSignaturePath(null);
      }
      setSignatureFile(null);
      setAlert({ type: "success", msg: "Profile updated successfully." });
    } else {
      const d = await res.json();
      setAlert({ type: "error", msg: d.error || "Failed to update profile." });
    }
    setTimeout(() => setAlert(null), 4000);
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <Sidebar role="doctor" email="doctor@mylab.com" />
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="doctor" email={email} />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }} id="main-content" tabIndex={-1}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5">{t("profile.title")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("profile.subtitle")}</Typography>
        </Box>

        {alert && <Alert severity={alert.type} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

        <Grid container spacing={3}>
          {/* Profile Info */}
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                  <PersonOutlined sx={{ color: "primary.main" }} />
                  <Typography variant="h6">{t("profile.personal_info")}</Typography>
                </Box>
                <Box component="form" onSubmit={handleSave} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    label={t("profile.display_name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                    placeholder={t("profile.name_placeholder")}
                    helperText={t("profile.name_helper")}
                  />
                  <TextField
                    label={t("profile.email_label")}
                    value={email}
                    fullWidth
                    disabled
                    helperText={t("profile.email_helper")}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined />}
                    disabled={saving}
                    fullWidth
                    sx={{ mt: 1 }}
                  >
                    {saving ? t("profile.saving") : t("profile.save")}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Signature Upload */}
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                  <ImageOutlined sx={{ color: "primary.main" }} />
                  <Typography variant="h6">{t("profile.signature")}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("profile.signature_desc")}
                </Typography>

                {/* Signature Preview */}
                <Box sx={{
                  border: "2px dashed",
                  borderColor: signaturePreview ? "primary.main" : "divider",
                  borderRadius: 2,
                  p: 3,
                  textAlign: "center",
                  bgcolor: signaturePreview ? "#f8fafc" : "transparent",
                  mb: 2,
                  minHeight: 160,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {signaturePreview ? (
                    <Box
                      component="img"
                      src={signaturePreview}
                      alt="Signature"
                      sx={{ maxWidth: "100%", maxHeight: 140, objectFit: "contain" }}
                    />
                  ) : (
                    <>
                      <Avatar sx={{ width: 56, height: 56, bgcolor: "#e8f0fe", color: "#0f4c81", mb: 1.5 }}>
                        <ImageOutlined />
                      </Avatar>
                      <Typography variant="body2" color="text.secondary">
                        {t("profile.no_signature")}
                      </Typography>
                    </>
                  )}
                </Box>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />

                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    startIcon={<ImageOutlined />}
                    onClick={() => fileRef.current?.click()}
                  >
                    {signaturePreview ? t("profile.change_signature") : t("profile.upload_signature")}
                  </Button>
                  {signaturePreview && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlined />}
                      onClick={async () => {
                        setSignaturePreview(null);
                        setSignatureFile(null);
                        setSaving(true);
                        if (!userId) return;
                        const res = await apiRequest(`/api/auth/profile/${userId}`, {
                          method: "PUT",
                          body: JSON.stringify({ name, signature_image: null }),
                        });
                        setSaving(false);
                        if (res.ok) {
                          setSignaturePath(null);
                          setAlert({ type: "success", msg: "Signature removed." });
                        }
                        setTimeout(() => setAlert(null), 3000);
                      }}
                    >
                      {t("profile.remove")}
                    </Button>
                  )}
                </Box>

                <Divider sx={{ my: 2.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {t("profile.format_hint")}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
