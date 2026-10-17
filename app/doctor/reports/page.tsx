"use client";

import { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, TextField, InputAdornment,
  CircularProgress, Button, ButtonGroup, Grid, IconButton, Tooltip,
} from "@mui/material";
import {
  SearchOutlined, TodayOutlined, DateRangeOutlined, ClearOutlined,
  DeleteOutlined, PaymentOutlined, EditOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Report {
  id: number;
  date: string;
  patient_name: string;
  patient_age: number;
  patient_weight: number;
  referred_by: string | null;
  total_price: number;
  payment_status: string;
  status: string;
}

type FilterMode = "all" | "today" | "range";

export default function DoctorReportsPage() {
  const { t } = useI18n();
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadReports = () =>
    apiRequest("/api/reports")
      .then((r) => r.json())
      .then((d) => { setReports(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => {
    loadReports();
    const onCreated = () => loadReports();
    window.addEventListener("mylab:report-created", onCreated);
    return () => window.removeEventListener("mylab:report-created", onCreated);
  }, []);

  async function togglePayment(r: Report) {
    const next = r.payment_status === "paid" ? "unpaid" : "paid";
    const res = await apiRequest(`/api/reports/${r.id}/payment`, {
      method: "PUT",
      body: JSON.stringify({ payment_status: next }),
    });
    if (res.ok) {
      setReports((prev) => prev.map((x) => x.id === r.id ? { ...x, payment_status: next } : x));
    }
  }

  async function handleDelete(r: Report) {
    if (!confirm(`Delete report #${r.id} for ${r.patient_name}? This cannot be undone.`)) return;
    const res = await apiRequest(`/api/reports/${r.id}`, { method: "DELETE" });
    if (res.ok) setReports((prev) => prev.filter((x) => x.id !== r.id));
  }

  const today = new Date().toISOString().slice(0, 10);

  const filtered = reports.filter((r) => {
    // Text search
    const matchesSearch =
      r.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.referred_by || "").toLowerCase().includes(search.toLowerCase());

    // Date filter
    let matchesDate = true;
    if (filterMode === "today") {
      matchesDate = r.date === today;
    } else if (filterMode === "range") {
      if (startDate) matchesDate = r.date >= startDate;
      if (endDate && matchesDate) matchesDate = r.date <= endDate;
    }

    return matchesSearch && matchesDate;
  });

  const filteredRevenue = filtered.reduce((s, r) => s + r.total_price, 0);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="doctor" email="doctor@mylab.com" />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }} id="main-content" tabIndex={-1}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5">{t("reports.title")}</Typography>
          <Typography variant="body2" color="text.secondary">{reports.length} {t("reports.total")}</Typography>
        </Box>

        <Card>
          <CardContent sx={{ pb: 1 }}>
            {/* Filters Row */}
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              {/* Quick filters */}
              <Grid item xs={12} md="auto">
                <ButtonGroup size="small" variant="outlined">
                  <Button
                    onClick={() => setFilterMode("all")}
                    variant={filterMode === "all" ? "contained" : "outlined"}
                  >
                    {t("common.all")}
                  </Button>
                  <Button
                    onClick={() => setFilterMode("today")}
                    variant={filterMode === "today" ? "contained" : "outlined"}
                    startIcon={<TodayOutlined sx={{ fontSize: 16 }} />}
                  >
                    {t("common.today")}
                  </Button>
                  <Button
                    onClick={() => setFilterMode("range")}
                    variant={filterMode === "range" ? "contained" : "outlined"}
                    startIcon={<DateRangeOutlined sx={{ fontSize: 16 }} />}
                  >
                    {t("reports.date_range")}
                  </Button>
                </ButtonGroup>
              </Grid>

              {/* Date range inputs */}
              {filterMode === "range" && (
                <>
                  <Grid item xs={6} sm={4} md={2}>
                    <TextField
                      type="date"
                      size="small"
                      label={t("reports.from")}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <TextField
                      type="date"
                      size="small"
                      label={t("reports.to")}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  {(startDate || endDate) && (
                    <Grid item xs="auto">
                      <Button
                        size="small"
                        onClick={() => { setStartDate(""); setEndDate(""); }}
                        startIcon={<ClearOutlined sx={{ fontSize: 14 }} />}
                        sx={{ textTransform: "none" }}
                      >
                        {t("reports.clear")}
                      </Button>
                    </Grid>
                  )}
                </>
              )}

              {/* Search */}
              <Grid item xs={12} md sx={{ display: "flex", justifyContent: "flex-end" }}>
                <TextField
                  placeholder={t("reports.search_placeholder")}
                  size="small"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ width: 260 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined sx={{ fontSize: 16 }} /></InputAdornment> }}
                />
              </Grid>
            </Grid>

            {/* Summary chips */}
            <Box sx={{ display: "flex", gap: 1.5, mb: 1 }}>
              <Chip
                label={`${filtered.length} ${t("reports.reports_count")}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: 12 }}
              />
              <Chip
                label={`₹${filteredRevenue.toFixed(0)} ${t("reports.revenue")}`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontSize: 12 }}
              />
              {filterMode === "today" && (
                <Chip label={`${t("table.date")}: ${new Date().toLocaleDateString("en-IN")}`} size="small" color="primary" variant="outlined" sx={{ fontSize: 12 }} />
              )}
              {filterMode === "range" && (startDate || endDate) && (
                <Chip
                  label={`${startDate || "…"} → ${endDate || "…"}`}
                  size="small" color="primary" variant="outlined" sx={{ fontSize: 12 }}
                />
              )}
            </Box>
          </CardContent>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 600, color: "text.secondary", fontSize: 12, bgcolor: "#f8fafc" } }}>
                    <TableCell>{t("reports.col_report")}</TableCell>
                    <TableCell>{t("reports.col_patient")}</TableCell>
                    <TableCell>{t("reports.col_age")}</TableCell>
                    <TableCell>{t("reports.col_weight")}</TableCell>
                    <TableCell>{t("reports.col_referred_by")}</TableCell>
                    <TableCell>{t("reports.col_date")}</TableCell>
                    <TableCell align="right">{t("reports.col_amount")}</TableCell>
                    <TableCell>{t("reports.col_status")}</TableCell>
                    <TableCell align="center">Payment</TableCell>
                    <TableCell align="center">{t("reports.col_view")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} hover sx={{ "& td": { fontSize: 13 } }}>
                      <TableCell sx={{ color: "text.secondary", fontWeight: 500 }}>#{r.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.patient_name}</TableCell>
                      <TableCell>{r.patient_age} yrs</TableCell>
                      <TableCell>{r.patient_weight} kg</TableCell>
                      <TableCell>{r.referred_by || <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                      <TableCell>{new Date(r.date).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: "#00897b" }}>₹{r.total_price.toFixed(0)}</TableCell>
                      <TableCell>
                        <Chip label={r.status} size="small"
                          color={r.status === "finalized" ? "success" : r.status === "results_entered" ? "info" : "warning"}
                          sx={{ fontSize: 10, height: 20 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={r.payment_status === "paid" ? "Mark unpaid" : "Mark paid"}>
                          <IconButton size="small" color={r.payment_status === "paid" ? "success" : "warning"} onClick={() => togglePayment(r)}>
                            <PaymentOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Button size="small" variant="text" href={`/doctor/reports/${r.id}`} sx={{ fontSize: 11, minWidth: 0 }} aria-label={`View report ${r.id}`}>
                          {t("reports.col_view")}
                        </Button>
                        <Tooltip title={t("common.edit")}>
                          <IconButton size="small" color="primary" href={`/doctor/reports/${r.id}/edit`} aria-label={`Edit report ${r.id}`}>
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("common.delete")}>
                          <IconButton size="small" color="error" onClick={() => handleDelete(r)} aria-label={`Delete report ${r.id}`}>
                            <DeleteOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 5, color: "text.secondary" }}>
                        {search || filterMode !== "all" ? t("reports.no_match") : t("reports.no_reports")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </Box>
    </Box>
  );
}
