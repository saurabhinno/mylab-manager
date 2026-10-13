"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box, Typography, Card, CardContent, TextField, Button, Alert,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Chip, CircularProgress, IconButton, Tooltip,
} from "@mui/material";
import {
  SaveOutlined, ArrowBackOutlined, CheckCircleOutlined,
  PaymentOutlined, DeleteOutlined, CloseOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";
import { useUser } from "@/lib/useUser";

interface ReportItemData {
  id: number;
  test_name: string;
  sample_type: string | null;
  result_value: string;
  result_type: string;
  unit: string | null;
  normal_min: number | null;
  normal_max: number | null;
  panel_name: string | null;
}

interface ReportData {
  id: number;
  patient_name: string;
  patient_age: number;
  patient_gender: string | null;
  date: string;
  status: string;
  payment_status: string;
  compounder_id: number;
  reportItems: ReportItemData[];
}

export default function EnterResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useUser();
  const [report, setReport] = useState<ReportData | null>(null);
  const [results, setResults] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const canDelete = !!me && (me.role === "doctor" || (report != null && report.compounder_id === me.id));

  useEffect(() => {
    if (params.id) {
      apiRequest(`/api/reports/${params.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) {
            setReport(d);
            const initial: Record<number, string> = {};
            d.reportItems?.forEach((item: ReportItemData) => { initial[item.id] = item.result_value || ""; });
            setResults(initial);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  function getStatus(item: ReportItemData, value: string): "normal" | "high" | "low" | "none" {
    if (!value || item.normal_min == null || item.normal_max == null) return "none";
    const val = parseFloat(value);
    if (isNaN(val)) return "none";
    if (val < item.normal_min) return "low";
    if (val > item.normal_max) return "high";
    return "normal";
  }

  // Group items by panel_name
  function getGroupedItems(): { panelName: string | null; items: ReportItemData[] }[] {
    if (!report?.reportItems) return [];
    const groups: { panelName: string | null; items: ReportItemData[] }[] = [];
    const seen = new Set<string>();

    for (const item of report.reportItems) {
      const key = item.panel_name || `standalone_${item.id}`;
      if (item.panel_name) {
        if (!seen.has(item.panel_name)) {
          seen.add(item.panel_name);
          groups.push({
            panelName: item.panel_name,
            items: report.reportItems.filter((i) => i.panel_name === item.panel_name),
          });
        }
      } else {
        groups.push({ panelName: null, items: [item] });
      }
    }
    return groups;
  }

  function handleKeyDown(e: React.KeyboardEvent, itemId: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      // Focus next input
      const allItems = report?.reportItems || [];
      const idx = allItems.findIndex((i) => i.id === itemId);
      if (idx < allItems.length - 1) {
        const nextId = allItems[idx + 1].id;
        inputRefs.current[nextId]?.focus();
      }
    }
  }

  async function togglePayment() {
    if (!report) return;
    const next = report.payment_status === "paid" ? "unpaid" : "paid";
    const res = await apiRequest(`/api/reports/${report.id}/payment`, {
      method: "PUT",
      body: JSON.stringify({ payment_status: next }),
    });
    if (res.ok) {
      setReport({ ...report, payment_status: next });
      setAlert({ type: "success", msg: next === "paid" ? "Marked as paid" : "Marked as unpaid" });
    } else {
      setAlert({ type: "error", msg: "Failed to update payment" });
    }
    setTimeout(() => setAlert(null), 3000);
  }

  async function handleDelete() {
    if (!report || !canDelete) return;
    if (!confirm(`Delete report #${report.id} for ${report.patient_name}? This cannot be undone.`)) return;
    const res = await apiRequest(`/api/reports/${report.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/compounder/reports");
    } else {
      const d = await res.json().catch(() => ({}));
      setAlert({ type: "error", msg: d.error || "Failed to delete" });
      setTimeout(() => setAlert(null), 4000);
    }
  }

  async function removeParameter(item: ReportItemData) {
    if (!report) return;
    if (report.reportItems.length <= 1) {
      setAlert({ type: "error", msg: "Cannot remove the last parameter. Delete the report instead." });
      setTimeout(() => setAlert(null), 4000);
      return;
    }
    if (!confirm(`Remove "${item.test_name}" from this report?`)) return;

    const res = await apiRequest(`/api/reports/${report.id}/items/${item.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setAlert({ type: "error", msg: d.error || "Failed to remove parameter" });
      setTimeout(() => setAlert(null), 4000);
      return;
    }

    setReport({
      ...report,
      reportItems: report.reportItems.filter((i) => i.id !== item.id),
    });
    setResults((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  }

  async function handleSave(finalize: boolean) {
    if (!report) return;
    setSaving(true);

    const payload = Object.entries(results).map(([itemId, value]) => ({
      itemId: Number(itemId),
      result_value: value,
    }));

    const res = await apiRequest(`/api/reports/${report.id}/results`, {
      method: "PUT",
      body: JSON.stringify({ results: payload }),
    });

    if (res.ok && finalize) {
      await apiRequest(`/api/reports/${report.id}/finalize`, { method: "PUT" });
    }

    setSaving(false);
    if (res.ok) {
      if (finalize) {
        router.push(`/compounder/reports/${report.id}`);
      } else {
        setAlert({ type: "success", msg: "Results saved as draft." });
        setTimeout(() => setAlert(null), 3000);
      }
    } else {
      setAlert({ type: "error", msg: "Failed to save results." });
      setTimeout(() => setAlert(null), 4000);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <Sidebar role="compounder" />
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (!report) {
    return (
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <Sidebar role="compounder" />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <Typography color="error">Report not found</Typography>
        </Box>
      </Box>
    );
  }

  const grouped = getGroupedItems();

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="compounder" />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }} id="main-content" tabIndex={-1}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Button variant="outlined" size="small" startIcon={<ArrowBackOutlined />} onClick={() => router.push("/compounder/reports")}>
            Back
          </Button>
          <Box>
            <Typography variant="h5">Enter Results — #{report.id}</Typography>
            <Typography variant="body2" color="text.secondary">
              {report.patient_name} • {report.patient_age} yrs {report.patient_gender ? `• ${report.patient_gender}` : ""} • {new Date(report.date).toLocaleDateString("en-IN")}
            </Typography>
          </Box>
        </Box>

        {alert && <Alert severity={alert.type} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

        {/* Grouped results by panel */}
        {grouped.map((group, gIdx) => (
          <Card key={gIdx} sx={{ mb: 2, borderRadius: 2 }}>
            {group.panelName && (
              <CardContent sx={{ pb: 0, bgcolor: "#f0f7ff", borderBottom: "1px solid #e2e8f0" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0f4c81" }}>
                  {group.panelName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {group.items.length} parameters
                </Typography>
              </CardContent>
            )}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 600, fontSize: 12, color: "text.secondary", bgcolor: "#f8fafc" } }}>
                    <TableCell>Test Parameter</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell>Normal Range</TableCell>
                    <TableCell>Result</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center" width={48} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.items.map((item) => {
                    const value = results[item.id] || "";
                    const status = getStatus(item, value);
                    const isAbnormal = status === "high" || status === "low";
                    return (
                      <TableRow key={item.id} sx={{ bgcolor: isAbnormal ? "#fef2f2" : "transparent" }}>
                        <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>{item.test_name}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{item.unit || "—"}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                          {item.normal_min != null && item.normal_max != null ? `${item.normal_min} – ${item.normal_max}` : "—"}
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            inputRef={(el) => { inputRefs.current[item.id] = el; }}
                            value={value}
                            onChange={(e) => setResults((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onKeyDown={(e) => handleKeyDown(e, item.id)}
                            placeholder="Enter value"
                            sx={{ width: 130 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {status === "normal" && <Chip label="Normal" size="small" color="success" sx={{ fontSize: 10, height: 20 }} />}
                          {status === "high" && <Chip label="High ↑" size="small" color="error" sx={{ fontSize: 10, height: 20 }} />}
                          {status === "low" && <Chip label="Low ↓" size="small" color="warning" sx={{ fontSize: 10, height: 20 }} />}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Remove from report">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeParameter(item)}
                              aria-label={`Remove ${item.test_name}`}
                            >
                              <CloseOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        ))}

        {/* Action buttons */}
        <Card sx={{ position: "sticky", bottom: 0, borderRadius: 2, mt: 2 }}>
          <CardContent>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
              <Button
                variant="outlined"
                color={report.payment_status === "paid" ? "success" : "warning"}
                onClick={togglePayment}
                startIcon={<PaymentOutlined />}
              >
                {report.payment_status === "paid" ? "Paid — Mark Unpaid" : "Unpaid — Mark Paid"}
              </Button>
              {canDelete && (
                <Button variant="outlined" color="error" onClick={handleDelete} startIcon={<DeleteOutlined />}>
                  Delete Report
                </Button>
              )}
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => handleSave(false)}
                disabled={saving}
                startIcon={<SaveOutlined />}
              >
                Save Draft
              </Button>
              <Button
                variant="contained"
                onClick={() => handleSave(true)}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlined />}
              >
                {saving ? "Saving…" : "Finalize & View Report"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
