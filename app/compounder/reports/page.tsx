"use client";

import React, { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Chip, TextField, InputAdornment,
  CircularProgress, Button, Alert, Fab,
} from "@mui/material";
import {
  SearchOutlined, AddOutlined, EditOutlined,
  ScienceOutlined, PrintOutlined,
  PaymentOutlined, DeleteOutlined,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/useUser";
import { reportDisplayNumber } from "@/lib/reportNumber";

interface Report {
  id: number;
  daily_number?: number | null;
  date: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string | null;
  patient_phone: string | null;
  referred_by: string | null;
  total_price: number;
  payment_status: string;
  status: string;
  compounder_id: number;
  compounder?: { id?: number; name: string | null; email: string };
}

type ViewFilter = "today" | "pending" | "done" | "all";

export default function CompounderReportsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { user: me } = useUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ViewFilter>("today");
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function canDeleteReport(r: Report) {
    if (!me) return false;
    if (me.role === "doctor") return true;
    return r.compounder_id === me.id;
  }

  const loadReports = () =>
    apiRequest("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        setReports(Array.isArray(d) ? d : []);
        setLoading(false);
      });

  useEffect(() => {
    loadReports();
    const onCreated = () => loadReports();
    window.addEventListener("mylab:report-created", onCreated);
    return () => window.removeEventListener("mylab:report-created", onCreated);
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = reports.filter((r) => {
    const matchesSearch =
      !search ||
      r.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.patient_phone || "").includes(search) ||
      String(r.id).includes(search);
    if (filter === "today") return matchesSearch && r.date === today;
    if (filter === "pending") return matchesSearch && r.status === "sample_collected";
    if (filter === "done")
      return matchesSearch && (r.status === "results_entered" || r.status === "finalized");
    return matchesSearch;
  });

  async function togglePayment(id: number, current: string) {
    const next = current === "paid" ? "unpaid" : "paid";
    const res = await apiRequest(`/api/reports/${id}/payment`, {
      method: "PUT",
      body: JSON.stringify({ payment_status: next }),
    });
    if (!res.ok) {
      setAlert({ type: "error", msg: "Failed to update payment" });
      setTimeout(() => setAlert(null), 3000);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(50);
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, payment_status: next } : r)));
  }

  async function handleDeleteReport(r: Report) {
    if (!canDeleteReport(r)) return;
    if (!confirm(`Delete report #${reportDisplayNumber(r)} for ${r.patient_name}? This cannot be undone.`)) return;
    const res = await apiRequest(`/api/reports/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      if (navigator.vibrate) navigator.vibrate(50);
      setReports((prev) => prev.filter((x) => x.id !== r.id));
      setAlert({ type: "success", msg: `Report #${reportDisplayNumber(r)} deleted` });
    } else {
      const d = await res.json().catch(() => ({}));
      setAlert({ type: "error", msg: d.error || "Failed to delete" });
    }
    setTimeout(() => setAlert(null), 3000);
  }

  const pendingCount = reports.filter((r) => r.status === "sample_collected").length;
  const todayCount = reports.filter((r) => r.date === today).length;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="compounder" />
      <Box
        sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, overflow: "auto", pb: 12 }}
        id="main-content"
        tabIndex={-1}
      >
        {alert && (
          <Alert
            severity={alert.type}
            sx={{ mb: 2, borderRadius: 2, fontSize: 15, py: 1 }}
            onClose={() => setAlert(null)}
          >
            {alert.msg}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t("compounder.reports")}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Chip
              icon={<ScienceOutlined sx={{ fontSize: 16 }} />}
              label={`${todayCount} today`}
              size="small"
              variant="outlined"
            />
            {pendingCount > 0 && (
              <Chip label={`${pendingCount} pending`} size="small" color="warning" />
            )}
          </Box>
        </Box>

        <TextField
          placeholder={`🔍 ${t("compounder.search_placeholder")}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{ mb: 2.5, "& .MuiOutlinedInput-root": { fontSize: 16, py: 0.5 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
          {(
            [
              { key: "today", label: `${t("common.today")} (${todayCount})`, color: "#0f4c81" },
              {
                key: "pending",
                label: `${t("common.pending")} (${pendingCount})`,
                color: "#f59e0b",
              },
              { key: "done", label: t("common.done"), color: "#10b981" },
              { key: "all", label: t("common.all"), color: "#6b7280" },
            ] as const
          ).map((f) => (
            <Button
              key={f.key}
              onClick={() => setFilter(f.key)}
              variant={filter === f.key ? "contained" : "outlined"}
              sx={{
                flex: 1,
                py: 1.5,
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 2,
                ...(filter === f.key
                  ? { bgcolor: f.color, "&:hover": { bgcolor: f.color } }
                  : {}),
              }}
            >
              {f.label}
            </Button>
          ))}
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress size={32} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {t("compounder.no_reports")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filter === "pending" ? t("compounder.all_caught_up") : ""}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              sx={{ mt: 2 }}
              onClick={() => router.push("/compounder/reports/new")}
            >
              {t("compounder.new_sample")}
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {filtered.map((r) => {
              const isPending = r.status === "sample_collected";
              const isDone = r.status === "finalized";
              return (
                <Card
                  key={r.id}
                  sx={{
                    borderRadius: 2,
                    borderLeft: `4px solid ${isPending ? "#f59e0b" : isDone ? "#10b981" : "#3b82f6"}`,
                  }}
                >
                  <CardContent sx={{ py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        mb: 1,
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 16 }}>
                          {r.patient_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {r.patient_age}y {r.patient_gender ? `/ ${r.patient_gender}` : ""}{" "}
                          {r.patient_phone ? `• ${r.patient_phone}` : ""}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography sx={{ fontWeight: 700, color: "#00897b", fontSize: 16 }}>
                          ₹{r.total_price.toFixed(0)}
                        </Typography>
                        <Chip
                          label={
                            r.payment_status === "paid" ? t("common.paid") : t("common.unpaid")
                          }
                          size="small"
                          color={r.payment_status === "paid" ? "success" : "warning"}
                          sx={{ fontSize: 10, height: 18, mt: 0.3 }}
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                        >
                          #{reportDisplayNumber(r)} •{" "}
                          {new Date(r.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Typography>
                        {r.compounder && (
                          <Typography
                            variant="caption"
                            sx={{ display: "block", color: "text.disabled", fontSize: 10 }}
                          >
                            by {r.compounder.name || r.compounder.email.split("@")[0]}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                      {isPending && (
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => router.push(`/compounder/reports/${r.id}/edit`)}
                          sx={{ py: 1.2, fontSize: 14, fontWeight: 600 }}
                          startIcon={<EditOutlined />}
                        >
                          {t("compounder.enter_results")}
                        </Button>
                      )}
                      {r.status === "results_entered" && (
                        <>
                          <Button
                            variant="outlined"
                            onClick={() => router.push(`/compounder/reports/${r.id}/edit`)}
                            sx={{ py: 1.2, fontSize: 13, flex: 1 }}
                            startIcon={<EditOutlined />}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="contained"
                            onClick={() => router.push(`/compounder/reports/${r.id}`)}
                            sx={{ py: 1.2, fontSize: 13, flex: 1 }}
                            startIcon={<PrintOutlined />}
                          >
                            Print
                          </Button>
                        </>
                      )}
                      {isDone && (
                        <>
                          <Button
                            variant="outlined"
                            onClick={() => router.push(`/compounder/reports/${r.id}/edit`)}
                            sx={{ py: 1.2, fontSize: 13, flex: 1 }}
                            startIcon={<EditOutlined />}
                          >
                            {t("common.edit")}
                          </Button>
                          <Button
                            variant="contained"
                            onClick={() => router.push(`/compounder/reports/${r.id}`)}
                            sx={{ py: 1.2, fontSize: 13, flex: 1 }}
                            startIcon={<PrintOutlined />}
                          >
                            {t("compounder.view_print")}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outlined"
                        color={r.payment_status === "paid" ? "success" : "warning"}
                        onClick={() => togglePayment(r.id, r.payment_status)}
                        sx={{ py: 1.2, minWidth: 44 }}
                        title={r.payment_status === "paid" ? t("common.paid") : t("common.unpaid")}
                      >
                        <PaymentOutlined />
                      </Button>
                      {canDeleteReport(r) && (
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => handleDeleteReport(r)}
                          sx={{ py: 1.2, minWidth: 44 }}
                          title={t("common.delete")}
                        >
                          <DeleteOutlined />
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}

        <Fab
          color="primary"
          onClick={() => router.push("/compounder/reports/new")}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 64,
            height: 64,
            boxShadow: "0 4px 20px rgba(15,76,129,0.4)",
            zIndex: 1200,
          }}
          aria-label={t("compounder.new_sample")}
        >
          <AddOutlined sx={{ fontSize: 32 }} />
        </Fab>
      </Box>
    </Box>
  );
}
