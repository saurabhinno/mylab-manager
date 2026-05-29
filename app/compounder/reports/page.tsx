"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, CardActionArea, Chip, TextField, InputAdornment,
  CircularProgress, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, FormControl, InputLabel, Select,
  MenuItem, FormControlLabel, Switch, Divider, Alert, Fab, Avatar,
  LinearProgress, Slide,
} from "@mui/material";
import {
  SearchOutlined, AddOutlined, EditOutlined, CloseOutlined,
  ScienceOutlined, PersonOutlined, PrintOutlined, CheckCircleOutlined,
  PhoneOutlined, NavigateNextOutlined, NavigateBeforeOutlined,
  PaymentOutlined, HistoryOutlined,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface TestDef { id: number; name: string; category: string; sample_type: string; price: number; }
interface ReportItem { id: number; test_name: string; sample_type: string | null; result_value: string; unit: string | null; normal_min: number | null; normal_max: number | null; }
interface Report { id: number; date: string; patient_name: string; patient_age: number; patient_gender: string | null; patient_phone: string | null; referred_by: string | null; total_price: number; payment_status: string; status: string; reportItems?: ReportItem[]; }

type ModalMode = null | "collect" | "results";
type ViewFilter = "pending" | "done" | "all";

export default function CompounderReportsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [reports, setReports] = useState<Report[]>([]);
  const [allTests, setAllTests] = useState<TestDef[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ViewFilter>("pending");
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Modal state
  const [modal, setModal] = useState<ModalMode>(null);
  const [activeReport, setActiveReport] = useState<Report | null>(null);

  // Collect sample form
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [selectedTestIds, setSelectedTestIds] = useState<number[]>([]);
  const [isPaid, setIsPaid] = useState(false);
  const [saving, setSaving] = useState(false);

  // Results form - wizard style
  const [results, setResults] = useState<Record<number, string>>({});
  const [currentTestIdx, setCurrentTestIdx] = useState(0);
  const resultInputRef = useRef<HTMLInputElement>(null);

  const loadReports = () =>
    apiRequest("/api/reports").then((r) => r.json()).then((d) => { setReports(Array.isArray(d) ? d : []); setLoading(false); });

  useEffect(() => {
    loadReports();
    apiRequest("/api/tests").then((r) => r.json()).then((d) => setAllTests(Array.isArray(d) ? d : []));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = reports.filter((r) => {
    const matchesSearch = !search || r.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.patient_phone || "").includes(search) || String(r.id).includes(search);
    if (filter === "pending") return matchesSearch && r.status === "sample_collected";
    if (filter === "done") return matchesSearch && (r.status === "results_entered" || r.status === "finalized");
    return matchesSearch;
  });

  // Recent patients (last 5 unique)
  const recentPatients = reports.slice(0, 10).reduce((acc, r) => {
    if (acc.length < 5 && !acc.find((p) => p.patient_phone === r.patient_phone && p.patient_name === r.patient_name)) {
      acc.push(r);
    }
    return acc;
  }, [] as Report[]);

  // Group tests by category
  const testsByCategory = allTests.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, TestDef[]>);

  function openCollect(prefill?: Report) {
    if (prefill) {
      setPatientName(prefill.patient_name);
      setAge(String(prefill.patient_age || ""));
      setGender(prefill.patient_gender || "");
      setPhone(prefill.patient_phone || "");
      setReferredBy(prefill.referred_by || "");
    } else {
      setPatientName(""); setAge(""); setGender(""); setPhone(""); setReferredBy("");
    }
    setSelectedTestIds([]); setIsPaid(false);
    setModal("collect");
  }

  function openResults(report: Report) {
    setActiveReport(report);
    setCurrentTestIdx(0);
    apiRequest(`/api/reports/${report.id}`).then((r) => r.json()).then((d) => {
      if (d.reportItems) {
        const init: Record<number, string> = {};
        d.reportItems.forEach((item: ReportItem) => { init[item.id] = item.result_value || ""; });
        setResults(init);
        setActiveReport(d);
      }
    });
    setModal("results");
  }

  function closeModal() { setModal(null); setActiveReport(null); }

  // Focus result input when test changes
  useEffect(() => {
    if (modal === "results" && resultInputRef.current) {
      setTimeout(() => resultInputRef.current?.focus(), 100);
    }
  }, [currentTestIdx, modal]);

  async function handleCollect() {
    if (!patientName.trim()) { setAlert({ type: "error", msg: "Patient name required" }); return; }
    if (selectedTestIds.length === 0) { setAlert({ type: "error", msg: "Select at least one test" }); return; }
    setSaving(true);
    const res = await apiRequest("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        patientName: patientName.trim(), age: Number(age) || 0, gender, phone, referredBy,
        tests: selectedTestIds.map((id) => ({ testId: id })),
        paymentStatus: isPaid ? "paid" : "unpaid",
      }),
    });
    setSaving(false);
    if (res.ok) {
      // Success feedback
      if (navigator.vibrate) navigator.vibrate(100);
      setAlert({ type: "success", msg: `✓ Sample registered for ${patientName}` });
      closeModal();
      loadReports();
    } else {
      const d = await res.json();
      setAlert({ type: "error", msg: d.error || "Failed" });
    }
    setTimeout(() => setAlert(null), 3000);
  }

  async function handleSaveResults(finalize: boolean) {
    if (!activeReport) return;
    setSaving(true);
    const payload = Object.entries(results).map(([itemId, value]) => ({ itemId: Number(itemId), result_value: value }));
    const res = await apiRequest(`/api/reports/${activeReport.id}/results`, { method: "PUT", body: JSON.stringify({ results: payload }) });
    if (res.ok && finalize) {
      await apiRequest(`/api/reports/${activeReport.id}/finalize`, { method: "PUT" });
    }
    setSaving(false);
    if (res.ok) {
      if (navigator.vibrate) navigator.vibrate(100);
      if (finalize) {
        closeModal();
        router.push(`/compounder/reports/${activeReport.id}?print=1`);
      } else {
        setAlert({ type: "success", msg: "✓ Results saved" });
        closeModal();
        loadReports();
      }
    } else {
      setAlert({ type: "error", msg: "Failed to save" });
    }
    setTimeout(() => setAlert(null), 3000);
  }

  async function markPaid(id: number) {
    await apiRequest(`/api/reports/${id}/payment`, { method: "PUT", body: JSON.stringify({ payment_status: "paid" }) });
    if (navigator.vibrate) navigator.vibrate(50);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, payment_status: "paid" } : r));
  }

  const selectedTests = allTests.filter((t) => selectedTestIds.includes(t.id));
  const totalPrice = selectedTests.reduce((s, t) => s + t.price, 0);

  // Wizard: current test item
  const testItems = activeReport?.reportItems || [];
  const currentItem = testItems[currentTestIdx];
  const filledCount = testItems.filter((item) => results[item.id]?.trim()).length;
  const progress = testItems.length > 0 ? (filledCount / testItems.length) * 100 : 0;

  function handleResultNext() {
    if (currentTestIdx < testItems.length - 1) setCurrentTestIdx(currentTestIdx + 1);
  }
  function handleResultPrev() {
    if (currentTestIdx > 0) setCurrentTestIdx(currentTestIdx - 1);
  }
  function handleResultKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleResultNext();
    }
  }

  const pendingCount = reports.filter((r) => r.status === "sample_collected").length;
  const todayCount = reports.filter((r) => r.date === today).length;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="compounder" />
      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, overflow: "auto", pb: 12 }} id="main-content" tabIndex={-1}>
        {alert && (
          <Alert severity={alert.type} sx={{ mb: 2, borderRadius: 2, fontSize: 15, py: 1 }} onClose={() => setAlert(null)}>
            {alert.msg}
          </Alert>
        )}

        {/* Header with stats */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{t("compounder.reports")}</Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Chip icon={<ScienceOutlined sx={{ fontSize: 16 }} />} label={`${todayCount} today`} size="small" variant="outlined" />
            {pendingCount > 0 && <Chip label={`${pendingCount} pending`} size="small" color="warning" />}
          </Box>
        </Box>

        {/* Search bar - prominent */}
        <TextField
          placeholder={`🔍 ${t("compounder.search_placeholder")}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{ mb: 2.5, "& .MuiOutlinedInput-root": { fontSize: 16, py: 0.5 } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment>,
          }}
        />

        {/* Filter tabs - large touch targets */}
        <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
          {([
            { key: "pending", label: `${t("common.pending")} (${pendingCount})`, color: "#f59e0b" },
            { key: "done", label: t("common.done"), color: "#10b981" },
            { key: "all", label: t("common.all"), color: "#6b7280" },
          ] as const).map((f) => (
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
                ...(filter === f.key ? { bgcolor: f.color, "&:hover": { bgcolor: f.color } } : {}),
              }}
            >
              {f.label}
            </Button>
          ))}
        </Box>

        {/* Reports as cards (mobile-friendly) */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress size={32} /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>{t("compounder.no_reports")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {filter === "pending" ? t("compounder.all_caught_up") : ""}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {filtered.map((r) => {
              const isPending = r.status === "sample_collected";
              const isDone = r.status === "finalized";
              return (
                <Card key={r.id} sx={{
                  borderRadius: 2,
                  borderLeft: `4px solid ${isPending ? "#f59e0b" : isDone ? "#10b981" : "#3b82f6"}`,
                }}>
                  <CardContent sx={{ py: 2, px: 2.5, "&:last-child": { pb: 2 } }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{r.patient_name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {r.patient_age}y {r.patient_gender ? `/ ${r.patient_gender}` : ""} {r.patient_phone ? `• ${r.patient_phone}` : ""}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography sx={{ fontWeight: 700, color: "#00897b", fontSize: 16 }}>₹{r.total_price.toFixed(0)}</Typography>
                        <Typography variant="caption" color="text.secondary">#{r.id}</Typography>
                      </Box>
                    </Box>

                    {/* Action buttons - large touch targets */}
                    <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                      {isPending && (
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => openResults(r)}
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
                            onClick={() => openResults(r)}
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
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => router.push(`/compounder/reports/${r.id}`)}
                          sx={{ py: 1.2, fontSize: 14 }}
                          startIcon={<PrintOutlined />}
                        >
                          {t("compounder.view_print")}
                        </Button>
                      )}
                      {r.payment_status !== "paid" && (
                        <Button
                          variant="outlined"
                          color="warning"
                          onClick={() => markPaid(r.id)}
                          sx={{ py: 1.2, minWidth: 44 }}
                        >
                          <PaymentOutlined />
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}

        {/* Floating Action Button - New Sample */}
        <Fab
          color="primary"
          onClick={() => openCollect()}
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

        {/* COLLECT SAMPLE DIALOG */}
        <Dialog open={modal === "collect"} onClose={closeModal} maxWidth="sm" fullWidth fullScreen PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1, pt: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PersonOutlined sx={{ color: "primary.main" }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{t("compounder.new_sample")}</Typography>
            </Box>
            <IconButton onClick={closeModal} size="large"><CloseOutlined /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 3 }}>
            {/* Recent patients */}
            {recentPatients.length > 0 && !patientName && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <HistoryOutlined sx={{ fontSize: 16, color: "text.secondary" }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", textTransform: "uppercase" }}>{t("compounder.recent_patients")}</Typography>
                </Box>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {recentPatients.map((p, i) => (
                    <Chip
                      key={i}
                      label={`${p.patient_name} ${p.patient_phone ? `• ${p.patient_phone}` : ""}`}
                      onClick={() => openCollect(p)}
                      sx={{ fontSize: 13, py: 2.5, cursor: "pointer" }}
                      avatar={<Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>{p.patient_name[0]}</Avatar>}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label={t("compounder.patient_name")}
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                  sx={{ "& .MuiOutlinedInput-root": { fontSize: 16 } }}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField label={t("compounder.age")} type="number" value={age} onChange={(e) => setAge(e.target.value)} fullWidth inputProps={{ min: 0, inputMode: "numeric" }} />
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth>
                  <InputLabel>{t("compounder.gender")}</InputLabel>
                  <Select value={gender} onChange={(e) => setGender(e.target.value)} label={t("compounder.gender")}>
                    <MenuItem value="">—</MenuItem>
                    <MenuItem value="M">Male</MenuItem>
                    <MenuItem value="F">Female</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ display: "flex", alignItems: "center", height: "100%", justifyContent: "center" }}>
                  <FormControlLabel
                    control={<Switch checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} color="success" />}
                    label={<Typography sx={{ fontSize: 14, fontWeight: 600 }}>{isPaid ? "Paid ✓" : "Unpaid"}</Typography>}
                  />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={t("compounder.phone")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  fullWidth
                  inputProps={{ inputMode: "tel" }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><PhoneOutlined sx={{ fontSize: 18 }} /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField label={t("compounder.referred_by")} value={referredBy} onChange={(e) => setReferredBy(e.target.value)} fullWidth />
              </Grid>

              {/* Tests selection */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, mt: 1 }}>
                  <ScienceOutlined sx={{ color: "primary.main" }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t("compounder.select_tests")}</Typography>
                  {selectedTestIds.length > 0 && (
                    <Chip label={`${selectedTestIds.length} ${t("compounder.selected")} • ₹${totalPrice}`} color="primary" sx={{ ml: "auto", fontWeight: 700, fontSize: 13 }} />
                  )}
                </Box>
                {Object.entries(testsByCategory).map(([cat, tests]) => (
                  <Box key={cat} sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", fontSize: 11 }}>{cat}</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mt: 0.5 }}>
                      {tests.map((t) => (
                        <Chip
                          key={t.id}
                          label={`${t.name} • ₹${t.price}`}
                          onClick={() => setSelectedTestIds((p) => p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id])}
                          color={selectedTestIds.includes(t.id) ? "primary" : "default"}
                          variant={selectedTestIds.includes(t.id) ? "filled" : "outlined"}
                          sx={{ cursor: "pointer", fontSize: 13, py: 2.5, fontWeight: selectedTestIds.includes(t.id) ? 600 : 400 }}
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid #e2e8f0" }}>
            <Button onClick={closeModal} variant="outlined" size="large" sx={{ px: 3 }}>{t("common.cancel")}</Button>
            <Button onClick={handleCollect} variant="contained" size="large" disabled={saving} sx={{ px: 4, py: 1.5, fontSize: 15 }}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlined />}>
              {saving ? t("common.loading") : t("compounder.register_sample")}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ENTER RESULTS - WIZARD STYLE */}
        <Dialog open={modal === "results"} onClose={closeModal} maxWidth="sm" fullWidth fullScreen PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}>
          <DialogTitle sx={{ pb: 1, pt: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{t("compounder.enter_results")}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {activeReport?.patient_name} • #{activeReport?.id}
                </Typography>
              </Box>
              <IconButton onClick={closeModal} size="large"><CloseOutlined /></IconButton>
            </Box>
            {/* Progress bar */}
            <Box sx={{ mt: 1.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">{filledCount} of {testItems.length} {t("compounder.filled_of")}</Typography>
                <Typography variant="caption" color="text.secondary">{Math.round(progress)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
            </Box>
          </DialogTitle>

          <DialogContent sx={{ display: "flex", flexDirection: "column", justifyContent: "center", px: 3 }}>
            {currentItem && (
              <Box sx={{ textAlign: "center", py: 4 }}>
                {/* Test counter */}
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 13 }}>
                  {t("compounder.test_of")} {currentTestIdx + 1} / {testItems.length}
                </Typography>

                {/* Test name - large */}
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                  {currentItem.test_name}
                </Typography>

                {/* Reference range */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                  {currentItem.normal_min != null && currentItem.normal_max != null
                    ? `Normal: ${currentItem.normal_min} – ${currentItem.normal_max} ${currentItem.unit || ""}`
                    : currentItem.unit ? `Unit: ${currentItem.unit}` : ""}
                </Typography>

                {/* Large input */}
                <TextField
                  inputRef={resultInputRef}
                  value={results[currentItem.id] || ""}
                  onChange={(e) => setResults((p) => ({ ...p, [currentItem.id]: e.target.value }))}
                  onKeyDown={handleResultKeyDown}
                  placeholder={t("compounder.enter_value")}
                  inputProps={{ inputMode: "decimal", style: { fontSize: 32, textAlign: "center", fontWeight: 700 } }}
                  sx={{ width: "100%", maxWidth: 280, mx: "auto", "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                />

                {/* Status indicator */}
                {(() => {
                  const val = results[currentItem.id] || "";
                  const numVal = parseFloat(val);
                  if (val && currentItem.normal_min != null && currentItem.normal_max != null && !isNaN(numVal)) {
                    if (numVal < currentItem.normal_min) return <Chip label="↓ LOW" color="warning" sx={{ mt: 2, fontSize: 14, py: 2, fontWeight: 700 }} />;
                    if (numVal > currentItem.normal_max) return <Chip label="↑ HIGH" color="error" sx={{ mt: 2, fontSize: 14, py: 2, fontWeight: 700 }} />;
                    return <Chip label={`✓ ${t("compounder.normal")}`} color="success" sx={{ mt: 2, fontSize: 14, py: 2, fontWeight: 700 }} />;
                  }
                  return null;
                })()}
              </Box>
            )}
          </DialogContent>

          {/* Navigation buttons */}
          <Box sx={{ px: 3, pb: 2 }}>
            <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
              <Button
                variant="outlined"
                onClick={handleResultPrev}
                disabled={currentTestIdx === 0}
                sx={{ flex: 1, py: 1.5, fontSize: 15 }}
                startIcon={<NavigateBeforeOutlined />}
              >
                {t("compounder.previous")}
              </Button>
              <Button
                variant="contained"
                onClick={handleResultNext}
                disabled={currentTestIdx >= testItems.length - 1}
                sx={{ flex: 1, py: 1.5, fontSize: 15 }}
                endIcon={<NavigateNextOutlined />}
              >
                {t("compounder.next")}
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button onClick={() => handleSaveResults(false)} variant="outlined" fullWidth disabled={saving} sx={{ py: 1.3, fontSize: 14 }}>
                {t("compounder.save_draft")}
              </Button>
              <Button onClick={() => handleSaveResults(true)} variant="contained" fullWidth disabled={saving} color="success" sx={{ py: 1.3, fontSize: 14 }}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlined />}>
                {saving ? t("common.loading") : t("compounder.finalize_print")}
              </Button>
            </Box>
          </Box>
        </Dialog>
      </Box>
    </Box>
  );
}
