"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Box, Typography, Button, CircularProgress, Divider, Table,
  TableBody, TableCell, TableHead, TableRow, TableContainer, Chip,
} from "@mui/material";
import { PrintOutlined, ArrowBackOutlined } from "@mui/icons-material";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ReportItemData {
  id: number;
  test_name: string;
  result_value: string;
  result_type: string;
  unit: string | null;
  normal_min: number | null;
  normal_max: number | null;
  price: number;
}

interface LabSettingsData {
  lab_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  header_text: string | null;
  footer_text: string | null;
}

interface ReportData {
  id: number;
  date: string;
  patient_name: string;
  patient_age: number;
  patient_weight: number;
  patient_gender: string | null;
  patient_phone: string | null;
  referred_by: string | null;
  total_price: number;
  payment_status: string;
  status: string;
  reportItems: ReportItemData[];
  doctor: { name: string | null; email: string; signature_image: string | null } | null;
  labSettings: LabSettingsData | null;
}

function getResultStatus(item: ReportItemData): "normal" | "high" | "low" | "unknown" {
  if (item.normal_min == null || item.normal_max == null) return "unknown";
  const val = parseFloat(item.result_value);
  if (isNaN(val)) return "unknown";
  if (val < item.normal_min) return "low";
  if (val > item.normal_max) return "high";
  return "normal";
}

export default function ReportViewPage() {
  const params = useParams();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      apiRequest(`/api/reports/${params.id}`)
        .then((r) => r.json())
        .then((d) => { if (!d.error) setReport(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) {
    return <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><CircularProgress /></Box>;
  }

  if (!report) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="error">Report not found</Typography>
        <Button component={Link} href="/compounder/reports" sx={{ mt: 2 }}>Back to Reports</Button>
      </Box>
    );
  }

  const lab = report.labSettings;

  return (
    <Box sx={{ bgcolor: "#f0f4f8", minHeight: "100vh", py: 3, px: 2 }}>
      {/* Action bar */}
      <Box sx={{ maxWidth: 800, mx: "auto", mb: 2, display: "flex", gap: 2, "@media print": { display: "none" } }}>
        <Button variant="outlined" size="small" startIcon={<ArrowBackOutlined />} component={Link} href="/compounder/reports">Back</Button>
        <Button variant="contained" size="small" startIcon={<PrintOutlined />} onClick={() => window.print()}>Print Report</Button>
        {report.status !== "finalized" && (
          <Button variant="outlined" size="small" color="warning" component={Link} href={`/compounder/reports/${report.id}/results`}>
            Edit Results
          </Button>
        )}
      </Box>

      {/* Printable Report */}
      <Box sx={{
        maxWidth: 800, mx: "auto", bgcolor: "#fff", borderRadius: 2,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)", overflow: "hidden",
        "@media print": { boxShadow: "none", borderRadius: 0, maxWidth: "100%" },
      }}>
        {/* Header */}
        <Box sx={{ px: 4, py: 3, borderBottom: "3px solid #0f4c81", display: "flex", alignItems: "center", gap: 3 }}>
          {lab?.logo_path && (
            <Box component="img" src={`${API_URL}/uploads/${lab.logo_path}`} alt="Logo" sx={{ height: 60, objectFit: "contain" }} />
          )}
          <Box sx={{ flexGrow: 1, textAlign: lab?.logo_path ? "left" : "center" }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f4c81" }}>{lab?.lab_name || "MyLab Diagnostics"}</Typography>
            {lab?.header_text && <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>{lab.header_text}</Typography>}
            {lab?.address && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{lab.address}</Typography>}
            <Typography variant="caption" color="text.secondary">
              {[lab?.phone, lab?.email].filter(Boolean).join(" • ")}
            </Typography>
          </Box>
        </Box>

        {/* Report meta */}
        <Box sx={{ px: 4, py: 0.8, bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>Report #{report.id}</Typography>
          <Typography variant="caption" color="text.secondary">
            Date: {new Date(report.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
          </Typography>
        </Box>

        {/* Patient Info */}
        <Box sx={{ px: 4, py: 2, borderBottom: "1px solid #e2e8f0" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: "uppercase" }}>Patient Name</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{report.patient_name}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: "uppercase" }}>Age / Gender</Typography>
              <Typography variant="body2">{report.patient_age} yrs {report.patient_gender ? `/ ${report.patient_gender}` : ""}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: "uppercase" }}>Referred By</Typography>
              <Typography variant="body2">{report.referred_by || "—"}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Test Results */}
        <Box sx={{ px: 4, py: 2.5 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 11, color: "#4a5568", borderBottom: "2px solid #0f4c81", py: 1 } }}>
                  <TableCell>Test Name</TableCell>
                  <TableCell align="center">Result</TableCell>
                  <TableCell align="center">Unit</TableCell>
                  <TableCell align="center">Reference Range</TableCell>
                  <TableCell align="center">Remark</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.reportItems?.map((item) => {
                  const status = getResultStatus(item);
                  const isAbnormal = status === "high" || status === "low";
                  return (
                    <TableRow key={item.id} sx={{
                      bgcolor: isAbnormal ? "#fef2f2" : "transparent",
                      "& td": { fontSize: 12, py: 1, borderBottom: "1px solid #f1f5f9" },
                    }}>
                      <TableCell sx={{ fontWeight: 500 }}>{item.test_name}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: isAbnormal ? "#dc2626" : "#1a2332" }}>
                        {item.result_value || "—"}
                      </TableCell>
                      <TableCell align="center" sx={{ color: "text.secondary" }}>{item.unit || "—"}</TableCell>
                      <TableCell align="center" sx={{ color: "text.secondary" }}>
                        {item.normal_min != null && item.normal_max != null
                          ? `${item.normal_min} – ${item.normal_max}${item.unit ? ` ${item.unit}` : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell align="center">
                        {status === "normal" && <Chip label="Normal" size="small" color="success" sx={{ fontSize: 9, height: 18, fontWeight: 600 }} />}
                        {status === "high" && <Chip label="HIGH" size="small" color="error" sx={{ fontSize: 9, height: 18, fontWeight: 700 }} />}
                        {status === "low" && <Chip label="LOW" size="small" color="warning" sx={{ fontSize: 9, height: 18, fontWeight: 700 }} />}
                        {status === "unknown" && <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Divider />

        {/* Footer */}
        <Box sx={{ px: 4, py: 2.5, display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
          <Box sx={{ textAlign: "center" }}>
            {report.doctor?.signature_image && (
              <Box component="img" src={`${API_URL}/uploads/${report.doctor.signature_image}`} alt="Signature" sx={{ height: 45, mb: 0.5, objectFit: "contain" }} />
            )}
            <Divider sx={{ mb: 0.5 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{report.doctor?.name || "Doctor"}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>Authorized Signatory</Typography>
          </Box>
        </Box>

        {/* Disclaimer */}
        <Box sx={{ px: 4, py: 1.5, bgcolor: "#f8fafc", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 8 }}>
            {lab?.footer_text || "This is a computer-generated report."}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
