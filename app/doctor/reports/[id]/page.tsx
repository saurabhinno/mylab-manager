"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Box, Typography, Button, CircularProgress, Divider, Table,
  TableBody, TableCell, TableHead, TableRow, TableContainer, Chip,
} from "@mui/material";
import { PrintOutlined, ArrowBackOutlined } from "@mui/icons-material";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ReportItemData {
  id: number;
  test_name: string;
  result_value: string;
  unit: string | null;
  normal_min: number | null;
  normal_max: number | null;
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

function getStatus(item: ReportItemData): "normal" | "high" | "low" | "unknown" {
  if (item.normal_min == null || item.normal_max == null) return "unknown";
  const val = parseFloat(item.result_value);
  if (isNaN(val)) return "unknown";
  if (val < item.normal_min) return "low";
  if (val > item.normal_max) return "high";
  return "normal";
}

export default function DoctorReportViewPage() {
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
    return (
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <Sidebar role="doctor" email="doctor@mylab.com" />
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress /></Box>
      </Box>
    );
  }

  if (!report) {
    return (
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <Sidebar role="doctor" email="doctor@mylab.com" />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <Typography color="error">Report not found</Typography>
          <Button component={Link} href="/doctor/reports" sx={{ mt: 2 }}>Back</Button>
        </Box>
      </Box>
    );
  }

  const lab = report.labSettings;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Box sx={{ "@media print": { display: "none" } }}><Sidebar role="doctor" email="doctor@mylab.com" /></Box>
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Action bar */}
        <Box sx={{ width: 794, mb: 2, display: "flex", gap: 2, "@media print": { display: "none" } }}>
          <Button variant="outlined" size="small" startIcon={<ArrowBackOutlined />} component={Link} href="/doctor/reports">Back</Button>
          <Button variant="contained" size="small" startIcon={<PrintOutlined />} onClick={() => window.print()}>Print</Button>
        </Box>

        {/* A4 Page */}
        <Box id="report-page" sx={{
          width: 794,
          minHeight: 1123,
          maxHeight: 1123,
          bgcolor: "#fff",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          "@media print": { width: "100%", height: "100vh", minHeight: "100vh", maxHeight: "100vh", boxShadow: "none", margin: 0 },
        }}>
          {/* HEADER */}
          <Box sx={{ px: 5, pt: 4, pb: 2, borderBottom: "3px solid #0f4c81" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
              {lab?.logo_path && <Box component="img" src={`${API_URL}/uploads/${lab.logo_path}`} alt="Logo" sx={{ height: 55, objectFit: "contain" }} />}
              <Box sx={{ flexGrow: 1, textAlign: lab?.logo_path ? "left" : "center" }}>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#0f4c81", lineHeight: 1.2 }}>{lab?.lab_name || "MyLab Diagnostics"}</Typography>
                {lab?.header_text && <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", fontSize: 11 }}>{lab.header_text}</Typography>}
                {lab?.address && <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 10 }}>{lab.address}</Typography>}
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{[lab?.phone, lab?.email].filter(Boolean).join(" • ")}</Typography>
              </Box>
            </Box>
          </Box>

          {/* BODY */}
          <Box sx={{ flexGrow: 1, px: 5, py: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11 }}>Report #{report.id}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                Date: {new Date(report.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
              </Typography>
            </Box>

            {/* Patient Info */}
            <Box sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 1.5, px: 2.5, py: 1.5, mb: 3 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: "uppercase", fontWeight: 600 }}>Patient Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13 }}>{report.patient_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: "uppercase", fontWeight: 600 }}>Age / Gender</Typography>
                  <Typography variant="body2" sx={{ fontSize: 13 }}>{report.patient_age} yrs {report.patient_gender ? `/ ${report.patient_gender}` : ""}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: "uppercase", fontWeight: 600 }}>Contact</Typography>
                  <Typography variant="body2" sx={{ fontSize: 13 }}>{report.patient_phone || "—"}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: "uppercase", fontWeight: 600 }}>Referred By</Typography>
                  <Typography variant="body2" sx={{ fontSize: 13 }}>{report.referred_by || "—"}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Results Table */}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 11, color: "#fff", bgcolor: "#0f4c81", py: 1 } }}>
                    <TableCell>Test Name</TableCell>
                    <TableCell align="center">Result</TableCell>
                    <TableCell align="center">Unit</TableCell>
                    <TableCell align="center">Reference Range</TableCell>
                    <TableCell align="center">Remark</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.reportItems?.map((item, idx) => {
                    const st = getStatus(item);
                    const abnormal = st === "high" || st === "low";
                    return (
                      <TableRow key={item.id} sx={{
                        bgcolor: abnormal ? "#fef2f2" : idx % 2 === 0 ? "#fff" : "#f8fafc",
                        "& td": { fontSize: 12, py: 1.2, borderBottom: "1px solid #e2e8f0" },
                      }}>
                        <TableCell sx={{ fontWeight: 500 }}>{item.test_name}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: abnormal ? "#dc2626" : "#1a2332", fontSize: 13 }}>{item.result_value || "—"}</TableCell>
                        <TableCell align="center" sx={{ color: "text.secondary" }}>{item.unit || "—"}</TableCell>
                        <TableCell align="center" sx={{ color: "text.secondary" }}>
                          {item.normal_min != null && item.normal_max != null ? `${item.normal_min} – ${item.normal_max}${item.unit ? ` ${item.unit}` : ""}` : "—"}
                        </TableCell>
                        <TableCell align="center">
                          {st === "normal" && <Chip label="Normal" size="small" color="success" sx={{ fontSize: 9, height: 18 }} />}
                          {st === "high" && <Chip label="HIGH" size="small" color="error" sx={{ fontSize: 9, height: 18, fontWeight: 700 }} />}
                          {st === "low" && <Chip label="LOW" size="small" color="warning" sx={{ fontSize: 9, height: 18, fontWeight: 700 }} />}
                          {st === "unknown" && <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* FOOTER */}
          <Box sx={{ mt: "auto", px: 5, pb: 3, pt: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
              <Box sx={{ textAlign: "center", minWidth: 180 }}>
                {report.doctor?.signature_image && <Box component="img" src={`${API_URL}/uploads/${report.doctor.signature_image}`} alt="Signature" sx={{ height: 45, mb: 0.5, objectFit: "contain" }} />}
                <Divider />
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5, fontSize: 12 }}>{report.doctor?.name || "Doctor"}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>Authorized Signatory</Typography>
              </Box>
            </Box>
            <Box sx={{ borderTop: "1px solid #e2e8f0", pt: 1.5, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 8 }}>{lab?.footer_text || "Computer-generated report."}</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
