"use client";

import { useEffect, useState } from "react";
import {
  Box, Typography, Card, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, TextField, InputAdornment,
  CircularProgress, Button, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, FormControl, InputLabel, Select,
  MenuItem, FormControlLabel, Switch, Divider, Alert, ButtonGroup,
} from "@mui/material";
import {
  SearchOutlined, AddOutlined, EditOutlined, VisibilityOutlined,
  PaymentOutlined, CloseOutlined, ScienceOutlined, PersonOutlined,
  PrintOutlined, CheckCircleOutlined, TodayOutlined,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";

interface TestDef {
  id: number;
  name: string;
  category: string;
  sample_type: string;
  price: number;
}

interface ReportItem {
  id: number;
  test_name: string;
  sample_type: string | null;
  result_value: string;
  unit: string | null;
  normal_min: number | null;
  normal_max: number | null;
}

interface Report {
  id: number;
  date: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string | null;
  patient_phone: string | null;
  referred_by: string | null;
  total_price: number;
  payment_status: string;
  status: string;
  reportItems?: ReportItem[];
}

type ModalMode = null | "collect" | "results";

export default function CompounderReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [allTests, setAllTests] = useState<TestDef[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "today" | "pending">("today");
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

  // Results form
  const [results, setResults] = useState<Record<number, string>>({});

  const loadReports = () =>
    apiRequest("/api/reports").then((r) => r.json()).then((d) => { setReports(Array.isArray(d) ? d : []); setLoading(false); });

  useEffect(() => {
    loadReports();
    apiRequest("/api/tests").then((r) => r.json()).then((d) => setAllTests(Array.isArray(d) ? d : []));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = reports.filter((r) => {
    const matchesSearch = r.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.patient_phone || "").includes(search) || String(r.id).includes(search);
    let matchesFilter = true;
    if (filter === "today") matchesFilter = r.date === today;
    else if (filter === "pending") matchesFilter = r.status === "sample_collected";
    return matchesSearch && matchesFilter;
  });

  // Group tests by category
  const testsByCategory = allTests.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, TestDef[]>);

  function openCollect() {
    setPatientName(""); setAge(""); setGender(""); setPhone(""); setReferredBy("");
    setSelectedTestIds([]); setIsPaid(false);
    setModal("collect");
  }

  function openResults(report: Report) {
    setActiveReport(report);
    // Load report details
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
      setAlert({ type: "success", msg: `Sample registered for ${patientName}` });
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
      if (finalize) {
        closeModal();
        router.push(`/compounder/reports/${activeReport.id}`);
      } else {
        setAlert({ type: "success", msg: "Results saved" });
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
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, payment_status: "paid" } : r));
  }

  const selectedTests = allTests.filter((t) => selectedTestIds.includes(t.id));
  const totalPrice = selectedTests.reduce((s, t) => s + t.price, 0);

  const statusConfig: Record<string, { label: string; color: "warning" | "info" | "success" }> = {
    sample_collected: { label: "Pending", color: "warning" },
    results_entered: { label: "Done", color: "info" },
    finalized: { label: "Final", color: "success" },
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="compounder" />
      <Box sx={{ flexGrow: 1, p: 2.5, overflow: "auto" }}>
        {alert && <Alert severity={alert.type} sx={{ mb: 1.5, borderRadius: 2, py: 0.5 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

        {/* Top bar */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <ButtonGroup size="small">
              <Button onClick={() => setFilter("today")} variant={filter === "today" ? "contained" : "outlined"} startIcon={<TodayOutlined sx={{ fontSize: 14 }} />}>Today</Button>
              <Button onClick={() => setFilter("pending")} variant={filter === "pending" ? "contained" : "outlined"} color="warning">Pending</Button>
              <Button onClick={() => setFilter("all")} variant={filter === "all" ? "contained" : "outlined"}>All</Button>
            </ButtonGroup>
            <TextField
              placeholder="Search name, phone, ID…"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined sx={{ fontSize: 16 }} /></InputAdornment> }}
            />
          </Box>
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCollect} sx={{ px: 3 }}>
            + New Sample
          </Button>
        </Box>

        {/* Reports Table */}
        <Card sx={{ borderRadius: 2 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress size={28} /></Box>
          ) : (
            <TableContainer sx={{ maxHeight: "calc(100vh - 160px)" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 11, color: "text.secondary", bgcolor: "#f8fafc", py: 1.2 } }}>
                    <TableCell>#</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Ref. By</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell align="right">₹</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((r) => {
                    const st = statusConfig[r.status] || { label: r.status, color: "default" as any };
                    return (
                      <TableRow key={r.id} hover sx={{ "& td": { fontSize: 12, py: 1 } }}>
                        <TableCell sx={{ color: "text.secondary", fontWeight: 500 }}>{r.id}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>{r.patient_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{r.patient_age}y {r.patient_gender ? `/ ${r.patient_gender}` : ""}</Typography>
                        </TableCell>
                        <TableCell>{r.patient_phone || "—"}</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{r.referred_by || "—"}</TableCell>
                        <TableCell><Chip label={st.label} size="small" color={st.color} sx={{ fontSize: 10, height: 20, fontWeight: 600 }} /></TableCell>
                        <TableCell>
                          {r.payment_status === "paid"
                            ? <Chip label="✓ Paid" size="small" color="success" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                            : <Chip label="Unpaid" size="small" color="error" variant="outlined" sx={{ fontSize: 10, height: 20, cursor: "pointer" }} onClick={() => markPaid(r.id)} />
                          }
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: "#00897b" }}>₹{r.total_price.toFixed(0)}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: "flex", gap: 0.3, justifyContent: "center" }}>
                            {(r.status === "sample_collected" || r.status === "results_entered" || (r.status === "finalized" && r.date === today)) && (
                              <Tooltip title="Enter/Edit Results">
                                <IconButton size="small" color="primary" onClick={() => openResults(r)}>
                                  <EditOutlined sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {(r.status === "results_entered" || r.status === "finalized") && (
                              <Tooltip title="View & Print">
                                <IconButton size="small" onClick={() => router.push(`/compounder/reports/${r.id}`)}>
                                  <PrintOutlined sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 5, color: "text.secondary" }}>
                        {loading ? "" : "No reports found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>

        {/* COLLECT SAMPLE DIALOG */}
        <Dialog open={modal === "collect"} onClose={closeModal} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PersonOutlined sx={{ color: "primary.main" }} />
              <Typography variant="h6">New Sample Collection</Typography>
            </Box>
            <IconButton size="small" onClick={closeModal}><CloseOutlined /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2.5}>
              {/* Patient fields */}
              <Grid item xs={12} sm={6}>
                <TextField label="Patient Name *" value={patientName} onChange={(e) => setPatientName(e.target.value)} fullWidth autoFocus />
              </Grid>
              <Grid item xs={4} sm={2}>
                <TextField label="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} fullWidth inputProps={{ min: 0 }} />
              </Grid>
              <Grid item xs={4} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Gender</InputLabel>
                  <Select value={gender} onChange={(e) => setGender(e.target.value)} label="Gender">
                    <MenuItem value="">—</MenuItem>
                    <MenuItem value="M">M</MenuItem>
                    <MenuItem value="F">F</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4} sm={2}>
                <FormControlLabel
                  control={<Switch checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} color="success" size="small" />}
                  label={<Typography variant="caption">{isPaid ? "Paid" : "Unpaid"}</Typography>}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Referred By" value={referredBy} onChange={(e) => setReferredBy(e.target.value)} fullWidth />
              </Grid>

              {/* Tests */}
              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, mt: 1 }}>
                  <ScienceOutlined sx={{ fontSize: 18, color: "primary.main" }} />
                  <Typography variant="subtitle2">Select Tests</Typography>
                  {selectedTestIds.length > 0 && <Chip label={`${selectedTestIds.length} • ₹${totalPrice}`} size="small" color="primary" sx={{ ml: "auto", fontWeight: 600 }} />}
                </Box>
                {Object.entries(testsByCategory).map(([cat, tests]) => (
                  <Box key={cat} sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", fontSize: 10, textTransform: "uppercase" }}>{cat}</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.3 }}>
                      {tests.map((t) => (
                        <Chip
                          key={t.id}
                          label={`${t.name} ₹${t.price}`}
                          size="small"
                          onClick={() => setSelectedTestIds((p) => p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id])}
                          color={selectedTestIds.includes(t.id) ? "primary" : "default"}
                          variant={selectedTestIds.includes(t.id) ? "filled" : "outlined"}
                          sx={{ cursor: "pointer", fontSize: 11 }}
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closeModal} variant="outlined">Cancel</Button>
            <Button onClick={handleCollect} variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlined />}>
              {saving ? "Saving…" : "Register Sample"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ENTER RESULTS DIALOG */}
        <Dialog open={modal === "results"} onClose={closeModal} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
            <Box>
              <Typography variant="h6">Enter Results — #{activeReport?.id}</Typography>
              <Typography variant="caption" color="text.secondary">
                {activeReport?.patient_name} • {activeReport?.patient_age}y
              </Typography>
            </Box>
            <IconButton size="small" onClick={closeModal}><CloseOutlined /></IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0 }}>
            <TableContainer sx={{ maxHeight: 450 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc" } }}>
                    <TableCell>Test</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell>Range</TableCell>
                    <TableCell>Result</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeReport?.reportItems?.map((item) => {
                    const val = results[item.id] || "";
                    const numVal = parseFloat(val);
                    let status: "normal" | "high" | "low" | "none" = "none";
                    if (val && item.normal_min != null && item.normal_max != null && !isNaN(numVal)) {
                      if (numVal < item.normal_min) status = "low";
                      else if (numVal > item.normal_max) status = "high";
                      else status = "normal";
                    }
                    return (
                      <TableRow key={item.id} sx={{ bgcolor: status === "high" || status === "low" ? "#fef2f2" : "transparent" }}>
                        <TableCell sx={{ fontWeight: 500, fontSize: 12 }}>{item.test_name}</TableCell>
                        <TableCell sx={{ fontSize: 11, color: "text.secondary" }}>{item.unit || "—"}</TableCell>
                        <TableCell sx={{ fontSize: 11, color: "text.secondary" }}>
                          {item.normal_min != null && item.normal_max != null ? `${item.normal_min}–${item.normal_max}` : "—"}
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={val}
                            onChange={(e) => setResults((p) => ({ ...p, [item.id]: e.target.value }))}
                            placeholder="Value"
                            sx={{ width: 110, "& input": { fontSize: 13, py: 0.8 } }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {status === "normal" && <Chip label="✓" size="small" color="success" sx={{ fontSize: 10, height: 18, width: 28 }} />}
                          {status === "high" && <Chip label="H" size="small" color="error" sx={{ fontSize: 10, height: 18, width: 28, fontWeight: 700 }} />}
                          {status === "low" && <Chip label="L" size="small" color="warning" sx={{ fontSize: 10, height: 18, width: 28, fontWeight: 700 }} />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
            <Button onClick={() => handleSaveResults(false)} variant="outlined" disabled={saving}>Save Draft</Button>
            <Button onClick={() => handleSaveResults(true)} variant="contained" disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlined />}>
              Finalize & Print
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
