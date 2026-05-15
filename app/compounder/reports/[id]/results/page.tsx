"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Box, Typography, Card, CardContent, TextField, Button, Alert,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Chip, CircularProgress, Divider, Grid,
} from "@mui/material";
import { SaveOutlined, ArrowBackOutlined, CheckCircleOutlined } from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";

interface ReportItemData {
  id: number;
  test_name: string;
  sample_type: string | null;
  result_value: string;
  result_type: string;
  unit: string | null;
  normal_min: number | null;
  normal_max: number | null;
}

interface ReportData {
  id: number;
  patient_name: string;
  patient_age: number;
  patient_gender: string | null;
  date: string;
  status: string;
  reportItems: ReportItemData[];
}

export default function EnterResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [results, setResults] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

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

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="compounder" />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }}>
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

        <Card>
          <CardContent sx={{ pb: 0 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Enter measured values for each test. Abnormal values will be highlighted automatically.
            </Typography>
          </CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 600, fontSize: 12, color: "text.secondary", bgcolor: "#f8fafc" } }}>
                  <TableCell>Test Name</TableCell>
                  <TableCell>Sample</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Normal Range</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.reportItems?.map((item) => {
                  const value = results[item.id] || "";
                  const status = getStatus(item, value);
                  const isAbnormal = status === "high" || status === "low";
                  return (
                    <TableRow key={item.id} sx={{ bgcolor: isAbnormal ? "#fef2f2" : "transparent" }}>
                      <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>{item.test_name}</TableCell>
                      <TableCell sx={{ fontSize: 11, color: "text.secondary" }}>{item.sample_type || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{item.unit || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                        {item.normal_min != null && item.normal_max != null ? `${item.normal_min} – ${item.normal_max}` : "—"}
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={value}
                          onChange={(e) => setResults((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Enter value"
                          sx={{ width: 130 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {status === "normal" && <Chip label="Normal" size="small" color="success" sx={{ fontSize: 10, height: 20 }} />}
                        {status === "high" && <Chip label="High ↑" size="small" color="error" sx={{ fontSize: 10, height: 20 }} />}
                        {status === "low" && <Chip label="Low ↓" size="small" color="warning" sx={{ fontSize: 10, height: 20 }} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <CardContent>
            <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
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
