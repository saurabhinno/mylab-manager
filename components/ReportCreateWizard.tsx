"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowBackOutlined,
  ArrowForwardOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  HistoryOutlined,
  SaveOutlined,
  ScienceOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";
import { reportDisplayNumber } from "@/lib/reportNumber";

type TestDef = {
  id: number;
  name: string;
  is_panel: boolean;
  price: number;
  category?: string | null;
  parameters?: { id: number }[];
};

type ReportItem = {
  id: number;
  test_definition_id?: number | null;
  test_name: string;
  result_value: string;
  unit: string | null;
  normal_min: number | null;
  normal_max: number | null;
  panel_name: string | null;
};

type ReportData = {
  id: number;
  daily_number?: number | null;
  patient_name: string;
  patient_age: number;
  patient_gender: string | null;
  patient_phone: string | null;
  referred_by: string | null;
  payment_status: string;
  status: string;
  reportItems: ReportItem[];
};

type RecentPatient = {
  patient_name: string;
  patient_age: number;
  patient_gender: string | null;
  patient_phone: string | null;
  referred_by: string | null;
};

function groupItemsIntoPages(items: ReportItem[]): { title: string; items: ReportItem[] }[] {
  const pages: { title: string; items: ReportItem[] }[] = [];
  const seenPanels = new Set<string>();
  for (const item of items) {
    if (item.panel_name) {
      if (!seenPanels.has(item.panel_name)) {
        seenPanels.add(item.panel_name);
        pages.push({
          title: item.panel_name,
          items: items.filter((i) => i.panel_name === item.panel_name),
        });
      }
    } else {
      pages.push({ title: item.test_name, items: [item] });
    }
  }
  return pages;
}

export default function ReportCreateWizard({
  role = "compounder",
}: {
  role?: "doctor" | "compounder";
}) {
  const router = useRouter();
  const listHref = role === "doctor" ? "/doctor/reports" : "/compounder/reports";

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [allTests, setAllTests] = useState<TestDef[]>([]);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);

  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [selectedTestIds, setSelectedTestIds] = useState<number[]>([]);
  const [testSearch, setTestSearch] = useState("");
  const [results, setResults] = useState<Record<number, string>>({});
  const [resultPageIdx, setResultPageIdx] = useState(0);

  const loadCatalog = useCallback(async () => {
    const [testsRes, reportsRes] = await Promise.all([
      apiRequest("/api/tests"),
      apiRequest("/api/reports"),
    ]);
    const tests = await testsRes.json();
    const reports = await reportsRes.json();
    setAllTests(Array.isArray(tests) ? tests : []);
    if (Array.isArray(reports)) {
      const recent: RecentPatient[] = [];
      for (const r of reports.slice(0, 20)) {
        if (
          recent.length < 5 &&
          !recent.find(
            (p) =>
              p.patient_name === r.patient_name && p.patient_phone === r.patient_phone
          )
        ) {
          recent.push({
            patient_name: r.patient_name,
            patient_age: r.patient_age,
            patient_gender: r.patient_gender,
            patient_phone: r.patient_phone,
            referred_by: r.referred_by,
          });
        }
      }
      setRecentPatients(recent);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const q = testSearch.trim().toLowerCase();
  const filteredTests = useMemo(() => {
    if (!q) return allTests;
    return allTests.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q)
    );
  }, [allTests, q]);

  const panelTests = filteredTests.filter((t) => t.is_panel);
  const standaloneByCategory = useMemo(() => {
    const map: Record<string, TestDef[]> = {};
    for (const t of filteredTests.filter((x) => !x.is_panel)) {
      const cat = t.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    }
    return map;
  }, [filteredTests]);

  const selectedTests = allTests.filter((t) => selectedTestIds.includes(t.id));
  const totalPrice = selectedTests.reduce((s, t) => s + (t.price || 0), 0);

  const resultPages = useMemo(
    () => groupItemsIntoPages(report?.reportItems || []),
    [report?.reportItems]
  );
  const currentResultPage = resultPages[resultPageIdx] || null;
  const isLastResultPage = resultPageIdx >= resultPages.length - 1;

  function applyRecent(p: RecentPatient) {
    setPatientName(p.patient_name || "");
    setAge(String(p.patient_age || ""));
    setGender(p.patient_gender || "");
    setPhone(p.patient_phone || "");
    setReferredBy(p.referred_by || "");
  }

  function toggleTest(id: number) {
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(listHref);
  }

  async function saveStep1AndContinue() {
    if (!patientName.trim()) {
      setAlert({ type: "error", msg: "Patient name required" });
      return;
    }
    if (selectedTestIds.length === 0) {
      setAlert({ type: "error", msg: "Select at least one test" });
      return;
    }
    setSaving(true);
    setAlert(null);
    try {
      const res = await apiRequest("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          patientName: patientName.trim(),
          age: Number(age) || 0,
          gender: gender || null,
          phone: phone || null,
          referredBy: referredBy || null,
          tests: selectedTestIds.map((id) => ({ testId: id })),
          paymentStatus: isPaid ? "paid" : "unpaid",
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setAlert({ type: "error", msg: d.error || "Failed to register sample" });
        setSaving(false);
        return;
      }

      const reportId = d.reportId;
      const fullRes = await apiRequest(`/api/reports/${reportId}`);
      const full = await fullRes.json();
      if (full.error) {
        setAlert({ type: "error", msg: full.error });
        setSaving(false);
        return;
      }

      setReport(full);
      const init: Record<number, string> = {};
      (full.reportItems || []).forEach((item: ReportItem) => {
        init[item.id] = item.result_value || "";
      });
      setResults(init);
      setResultPageIdx(0);
      setStep(2);
      setAlert({ type: "success", msg: "Sample registered — enter results" });
      try {
        window.dispatchEvent(new Event("mylab:report-created"));
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setAlert({ type: "error", msg: e?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function saveResults(finalize: boolean) {
    if (!report) return;
    setSaving(true);
    setAlert(null);
    try {
      const payload = Object.entries(results).map(([itemId, value]) => ({
        itemId: Number(itemId),
        result_value: value,
      }));
      const res = await apiRequest(`/api/reports/${report.id}/results`, {
        method: "PUT",
        body: JSON.stringify({ results: payload }),
      });
      if (!res.ok) {
        setAlert({ type: "error", msg: "Failed to save results" });
        setSaving(false);
        return;
      }
      if (finalize) {
        await apiRequest(`/api/reports/${report.id}/finalize`, { method: "PUT" });
        const preview =
          role === "doctor"
            ? `/doctor/reports/${report.id}`
            : `/compounder/reports/${report.id}`;
        router.push(preview);
        return;
      }
      setAlert({ type: "success", msg: "Draft saved" });
    } catch (e: any) {
      setAlert({ type: "error", msg: e?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function removeParameter(item: ReportItem) {
    if (!report) return;
    const total = (report.reportItems || []).length;
    if (total <= 1) {
      setAlert({
        type: "error",
        msg: "Cannot remove the last parameter. Delete the report instead.",
      });
      return;
    }
    if (!confirm(`Remove "${item.test_name}" from this report?`)) return;

    setSaving(true);
    setAlert(null);
    try {
      const res = await apiRequest(`/api/reports/${report.id}/items/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setAlert({ type: "error", msg: d.error || "Failed to remove parameter" });
        setSaving(false);
        return;
      }

      const nextItems = (report.reportItems || []).filter((i) => i.id !== item.id);
      setReport({ ...report, reportItems: nextItems });
      setResults((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });

      const pages = groupItemsIntoPages(nextItems);
      if (resultPageIdx >= pages.length) {
        setResultPageIdx(Math.max(0, pages.length - 1));
      }
      setAlert({ type: "success", msg: `Removed ${item.test_name}` });
    } catch (e: any) {
      setAlert({ type: "error", msg: e?.message || "Remove failed" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar role={role} />
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role={role} />
      <Box sx={{ flexGrow: 1, width: "100%", minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
          <Button size="small" startIcon={<ArrowBackOutlined />} onClick={goBack}>
            Back
          </Button>
          <Typography variant="h6" fontWeight={700}>
            {step === 1
              ? "New sample"
              : `Enter results · #${report ? reportDisplayNumber(report) : ""}`}
          </Typography>
          <Chip
            size="small"
            label={step === 1 ? "Step 1 · Details & tests" : "Step 2 · Enter results"}
            color="primary"
            variant="outlined"
          />
        </Stack>

        {alert && (
          <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
            {alert.msg}
          </Alert>
        )}

        {step === 1 && (
          <Box sx={{ bgcolor: "#fff", border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}>
            {recentPatients.length > 0 && !patientName && (
              <Box sx={{ mb: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <HistoryOutlined sx={{ fontSize: 16, color: "text.secondary" }} />
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color: "text.secondary", textTransform: "uppercase" }}
                  >
                    Recent patients
                  </Typography>
                </Stack>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {recentPatients.map((p, i) => (
                    <Chip
                      key={i}
                      label={`${p.patient_name}${p.patient_phone ? ` · ${p.patient_phone}` : ""}`}
                      onClick={() => applyRecent(p)}
                      avatar={
                        <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                          {(p.patient_name || "?")[0]}
                        </Avatar>
                      }
                      sx={{ cursor: "pointer" }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              Patient details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Patient name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth>
                  <InputLabel>Gender</InputLabel>
                  <Select
                    value={gender}
                    label="Gender"
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <MenuItem value="">—</MenuItem>
                    <MenuItem value="M">Male</MenuItem>
                    <MenuItem value="F">Female</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isPaid}
                      onChange={(e) => setIsPaid(e.target.checked)}
                      color="success"
                    />
                  }
                  label={isPaid ? "Paid" : "Unpaid"}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Referred by"
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                  fullWidth
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, mt: 1 }}>
                  <ScienceOutlined color="primary" />
                  <Typography variant="subtitle1" fontWeight={700}>
                    Select tests
                  </Typography>
                  {selectedTestIds.length > 0 && (
                    <Chip
                      label={`${selectedTestIds.length} selected · ₹${totalPrice}`}
                      color="primary"
                      sx={{ ml: "auto", fontWeight: 700 }}
                    />
                  )}
                </Stack>
                <TextField
                  placeholder="Search tests…"
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlined sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                {panelTests.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, color: "#0f4c81", textTransform: "uppercase" }}
                    >
                      Panel tests
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mt: 0.5 }}>
                      {panelTests.map((t) => (
                        <Chip
                          key={t.id}
                          label={`${t.name}${t.parameters?.length ? ` (${t.parameters.length})` : ""} · ₹${t.price}`}
                          onClick={() => toggleTest(t.id)}
                          color={selectedTestIds.includes(t.id) ? "primary" : "default"}
                          variant={selectedTestIds.includes(t.id) ? "filled" : "outlined"}
                          sx={{
                            cursor: "pointer",
                            fontWeight: selectedTestIds.includes(t.id) ? 600 : 400,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                {Object.entries(standaloneByCategory).map(([cat, tests]) => (
                  <Box key={cat} sx={{ mb: 2 }}>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase" }}
                    >
                      {cat}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mt: 0.5 }}>
                      {tests.map((t) => (
                        <Chip
                          key={t.id}
                          label={`${t.name} · ₹${t.price}`}
                          onClick={() => toggleTest(t.id)}
                          color={selectedTestIds.includes(t.id) ? "primary" : "default"}
                          variant={selectedTestIds.includes(t.id) ? "filled" : "outlined"}
                          sx={{ cursor: "pointer" }}
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Grid>
            </Grid>

            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
              <Button variant="outlined" onClick={goBack}>
                Cancel
              </Button>
              <Button
                variant="contained"
                disabled={saving}
                endIcon={
                  saving ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardOutlined />
                }
                onClick={() => void saveStep1AndContinue()}
              >
                Save & enter results
              </Button>
            </Stack>
          </Box>
        )}

        {step === 2 && report && (
          <Box sx={{ bgcolor: "#fff", border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
              flexWrap="wrap"
              gap={1}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {patientName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  One page per test/panel · Remove any parameter · Save draft anytime
                </Typography>
              </Box>
            </Stack>

            {resultPages.length > 1 && (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                {resultPages.map((p, idx) => (
                  <Chip
                    key={`${p.title}-${idx}`}
                    size="small"
                    label={p.title}
                    color={idx === resultPageIdx ? "primary" : "default"}
                    variant={idx === resultPageIdx ? "filled" : "outlined"}
                    onClick={() => setResultPageIdx(idx)}
                    sx={{ cursor: "pointer", maxWidth: 180 }}
                  />
                ))}
              </Stack>
            )}

            {currentResultPage && (
              <>
                <Box
                  sx={{
                    bgcolor: "#f0f7ff",
                    px: 2,
                    py: 1.25,
                    borderRadius: 2,
                    mb: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0f4c81" }}>
                    {currentResultPage.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Page {resultPageIdx + 1} of {resultPages.length}
                  </Typography>
                </Box>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Parameter</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell>Result</TableCell>
                        <TableCell align="right" width={56} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentResultPage.items.map((item) => {
                        const val = results[item.id] ?? "";
                        const num = parseFloat(val);
                        let flag = "";
                        if (
                          val &&
                          !isNaN(num) &&
                          item.normal_min != null &&
                          item.normal_max != null
                        ) {
                          if (num < item.normal_min) flag = "LOW";
                          else if (num > item.normal_max) flag = "HIGH";
                        }
                        const range =
                          item.normal_min != null && item.normal_max != null
                            ? `${item.normal_min} – ${item.normal_max}`
                            : "";
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>
                                {item.test_name}
                              </Typography>
                            </TableCell>
                            <TableCell
                              sx={{ whiteSpace: "nowrap", color: "text.secondary", fontSize: 12 }}
                            >
                              {[range, item.unit].filter(Boolean).join(" ") || "—"}
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                  size="small"
                                  value={val}
                                  onChange={(e) =>
                                    setResults((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  sx={{ width: 120 }}
                                  autoFocus={item.id === currentResultPage.items[0]?.id}
                                />
                                {flag && (
                                  <Chip
                                    size="small"
                                    label={flag}
                                    color={flag === "HIGH" ? "error" : "warning"}
                                    sx={{ height: 22, fontSize: 10 }}
                                  />
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Remove parameter">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={saving || (report.reportItems || []).length <= 1}
                                    onClick={() => void removeParameter(item)}
                                    aria-label={`Remove ${item.test_name}`}
                                  >
                                    <CloseOutlined fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ mt: 3 }}
            >
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  disabled={resultPageIdx === 0}
                  startIcon={<ArrowBackOutlined />}
                  onClick={() => setResultPageIdx((i) => Math.max(0, i - 1))}
                >
                  Prev test
                </Button>
                <Button
                  variant="outlined"
                  disabled={isLastResultPage}
                  endIcon={<ArrowForwardOutlined />}
                  onClick={() =>
                    setResultPageIdx((i) => Math.min(resultPages.length - 1, i + 1))
                  }
                >
                  Next test
                </Button>
              </Stack>
              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  disabled={saving}
                  startIcon={<SaveOutlined />}
                  onClick={() => void saveResults(false)}
                >
                  Save draft
                </Button>
                <Button
                  variant="contained"
                  disabled={saving}
                  startIcon={
                    saving ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <CheckCircleOutlined />
                    )
                  }
                  onClick={() => void saveResults(true)}
                >
                  Finalize & preview
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}
