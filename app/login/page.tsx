"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Paper, Typography, TextField, Button, Alert,
  InputAdornment, IconButton,
} from "@mui/material";
import {
  EmailOutlined, LockOutlined, VisibilityOutlined,
  VisibilityOffOutlined, LocalHospitalOutlined,
} from "@mui/icons-material";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(data.redirect || "/doctor/dashboard");
      } else {
        setError(data.error || "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{
      minHeight: "100vh",
      display: "flex",
      background: "linear-gradient(135deg, #0f4c81 0%, #1565c0 50%, #00897b 100%)",
    }}>
      {/* Left branding panel */}
      <Box sx={{
        flex: 1, display: { xs: "none", md: "flex" },
        flexDirection: "column", justifyContent: "center",
        alignItems: "center", px: 6, color: "#fff",
      }}>
        <Box sx={{ mb: 3, width: 72, height: 72, borderRadius: 4, bgcolor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LocalHospitalOutlined sx={{ fontSize: 40 }} />
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>{t("app.name")}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 400, opacity: 0.85, mb: 4 }}>{t("app.tagline")}</Typography>
        <Box sx={{ maxWidth: 340, textAlign: "center" }}>
          <Typography sx={{ opacity: 0.75, lineHeight: 1.8 }}>
            {t("login.branding_text")}
          </Typography>
        </Box>
      </Box>

      {/* Right login form */}
      <Box sx={{
        width: { xs: "100%", md: 460 },
        display: "flex", alignItems: "center", justifyContent: "center",
        p: 3,
      }}>
        <Paper elevation={0} sx={{ width: "100%", maxWidth: 400, p: 4, borderRadius: 3 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#0f4c81" }}>{t("login.title")}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t("login.subtitle")}
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label={t("login.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment>,
              }}
            />
            <TextField
              label={t("login.password")}
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockOutlined sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw(!showPw)}>
                      {showPw ? <VisibilityOffOutlined sx={{ fontSize: 18 }} /> : <VisibilityOutlined sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              size="large"
              sx={{ mt: 1, py: 1.4 }}
            >
              {loading ? t("login.signing_in") : t("login.submit")}
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3, textAlign: "center" }}>
            {t("login.default_hint")}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
