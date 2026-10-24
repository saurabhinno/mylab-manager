"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Box, Typography, Button, CircularProgress, Divider, Table,
  TableBody, TableCell, TableHead, TableRow, TableContainer,
} from "@mui/material";
import { PrintOutlined, ArrowBackOutlined, PaymentOutlined, DeleteOutlined, EditOutlined } from "@mui/icons-material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useUser } from "@/lib/useUser";
import { printReport } from "@/lib/printReport";
import { reportDisplayNumber } from "@/lib/reportNumber";

interface ReportItemData {
  id: number;
  test_definition_id?: number | null;
  test_name: string;
  result_value: string;
  result_type: string;
  unit: string | null;
  normal_min: number | null;
  normal_max: number | null;
  panel_name: string | null;
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
  daily_number?: number | null;
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
  compounder_id: number;
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

// Group items into separate report pages (one per panel, one per standalone test)
function groupItemsIntoPages(items: ReportItemData[]): { title: string; items: ReportItemData[] }[] {
  const pages: { title: string; items: ReportItemData[] }[] = [];
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

export default function ReportViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useUser();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoPrinted, setAutoPrinted] = useState(false);

  const canDelete = !!me && !!report && (me.role === "doctor" || report.compounder_id === me.id);

  async function togglePayment() {
    if (!report) return;
    const next = report.payment_status === "paid" ? "unpaid" : "paid";
    const res = await apiRequest(`/api/reports/${report.id}/payment`, {
      method: "PUT",
      body: JSON.stringify({ payment_status: next }),
    });
    if (res.ok) setReport({ ...report, payment_status: next });
  }

  async function handleDelete() {
    if (!report || !canDelete) return;
    if (!confirm(`Delete report #${reportDisplayNumber(report)} for ${report.patient_name}? This cannot be undone.`)) return;
    const res = await apiRequest(`/api/reports/${report.id}`, { method: "DELETE" });
    if (res.ok) router.push("/compounder/reports");
  }

  function loadReport() {
    if (!params.id) return;
    apiRequest(`/api/reports/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setReport(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadReport();
  }, [params.id]);

  useEffect(() => {
    if (report && !autoPrinted && typeof window !== "undefined") {
      const fromFinalize = new URLSearchParams(window.location.search).get("print");
      if (fromFinalize === "1") {
        setAutoPrinted(true);
        setTimeout(() => void printReport(), 500);
      }
    }
  }, [report, autoPrinted]);

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
  const pages = groupItemsIntoPages(report.reportItems || []);

  return (
    <Box sx={{ bgcolor: "#e2e8f0", minHeight: "100vh", py: 3, px: 2, "@media print": { bgcolor: "#fff", p: 0, m: 0, minHeight: 0 } }}>
      {/* Action bar — hidden on print */}
      <Box data-noprint="true" sx={{ maxWidth: 794, mx: "auto", mb: 2, display: "flex", gap: 2, flexWrap: "wrap", "@media print": { display: "none !important" } }}>
        <Button variant="outlined" size="small" startIcon={<ArrowBackOutlined />} component={Link} href="/compounder/reports">Back</Button>
        <Button variant="outlined" size="small" startIcon={<EditOutlined />} component={Link} href={`/compounder/reports/${report.id}/edit`}>
          Edit
        </Button>
        <Button variant="contained" size="small" startIcon={<PrintOutlined />} onClick={() => void printReport()}>Print All Reports</Button>
        <Button
          variant="outlined"
          size="small"
          color={report.payment_status === "paid" ? "success" : "warning"}
          startIcon={<PaymentOutlined />}
          onClick={togglePayment}
        >
          {report.payment_status === "paid" ? "Paid — Mark Unpaid" : "Unpaid — Mark Paid"}
        </Button>
        {canDelete && (
          <Button variant="outlined" size="small" color="error" startIcon={<DeleteOutlined />} onClick={handleDelete}>
            Delete
          </Button>
        )}
      </Box>

      {/* Preview only — edit patient/tests/results via Edit */}
      {pages.map((page, pageIdx) => {
        const compact = page.items.length > 12;
        return (
        <Box key={pageIdx} className={`report-page${compact ? " report-page--compact" : ""}`} sx={{
          width: 794,
          minHeight: 1123,
          mx: "auto",
          mb: 3,
          bgcolor: "#fff",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          pageBreakAfter: "always",
          pageBreakInside: "avoid",
          "@media print": {
            width: "100%",
            boxShadow: "none",
            margin: 0,
            mb: 0,
            overflow: "visible",
          },
        }}>
          {/* HEADER — always full size for A4 */}
          <Box className="report-header" sx={{ px: 5, pt: 3, pb: 2, borderBottom: "3px solid #0f4c81" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {lab?.logo_path && (
                <Box
                  component="img"
                  className="report-logo"
                  src={lab.logo_path}
                  alt="Logo"
                  sx={{ height: 55, objectFit: "contain" }}
                />
              )}
              <Box sx={{ flexGrow: 1, textAlign: lab?.logo_path ? "left" : "center" }}>
                <Typography className="report-lab-name" sx={{ fontSize: 22, fontWeight: 800, color: "#0f4c81", lineHeight: 1.2 }}>
                  {lab?.lab_name || "MyLab Diagnostics"}
                </Typography>
                {lab?.header_text && (
                  <Typography className="report-lab-meta" variant="body2" color="text.secondary" sx={{ fontStyle: "italic", fontSize: 11 }}>
                    {lab.header_text}
                  </Typography>
                )}
                {lab?.address && (
                  <Typography className="report-lab-meta" variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 10 }}>
                    {lab.address}
                  </Typography>
                )}
                <Typography className="report-lab-meta" variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                  {[lab?.phone, lab?.email].filter(Boolean).join(" • ")}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* BODY */}
          <Box className="report-body" sx={{ flexGrow: 1, px: 5, py: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 12 }}>Report #{reportDisplayNumber(report)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
                Date: {new Date(report.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
              </Typography>
            </Box>

            <Box sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 1, px: 2.5, py: 1.5, mb: 2 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: "uppercase", fontWeight: 600 }}>Patient Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 14 }}>{report.patient_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: "uppercase", fontWeight: 600 }}>Age / Gender</Typography>
                  <Typography variant="body2" sx={{ fontSize: 14 }}>{report.patient_age} yrs {report.patient_gender ? `/ ${report.patient_gender}` : ""}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: "uppercase", fontWeight: 600 }}>Contact</Typography>
                  <Typography variant="body2" sx={{ fontSize: 14 }}>{report.patient_phone || "—"}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: "uppercase", fontWeight: 600 }}>Referred By</Typography>
                  <Typography variant="body2" sx={{ fontSize: 14 }}>{report.referred_by || "—"}</Typography>
                </Box>
              </Box>
            </Box>

            <Typography className="report-test-title" sx={{ fontSize: 18, fontWeight: 700, color: "#0f4c81", mb: 1.5, borderBottom: "2px solid #0f4c81", pb: 0.5 }}>
              {page.title}
            </Typography>

            <TableContainer>
              <Table size="small" className="report-results-table">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 15, color: "#fff", bgcolor: "#0f4c81", py: 1 } }}>
                    <TableCell>Test Parameter</TableCell>
                    <TableCell align="center">Result</TableCell>
                    <TableCell align="center">Reference Range</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {page.items.map((item, idx) => {
                    const status = getResultStatus(item);
                    const isAbnormal = status === "high" || status === "low";
                    const range =
                      item.normal_min != null && item.normal_max != null
                        ? `${item.normal_min} – ${item.normal_max}`
                        : "";
                    const rangeWithUnit = [range, item.unit].filter(Boolean).join(" ") || "—";
                    return (
                      <TableRow key={item.id} sx={{
                        bgcolor: isAbnormal ? "#fef2f2" : idx % 2 === 0 ? "#fff" : "#f8fafc",
                        "& td": { fontSize: 15, py: compact ? 0.55 : 1, borderBottom: "1px solid #e2e8f0" },
                      }}>
                        <TableCell sx={{ fontWeight: 500 }}>{item.test_name}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: isAbnormal ? "#dc2626" : "#1a2332", fontSize: 16 }}>
                          {item.result_value || "—"}
                          {isAbnormal && status === "high" ? " ↑" : ""}
                          {isAbnormal && status === "low" ? " ↓" : ""}
                        </TableCell>
                        <TableCell align="center" sx={{ color: "text.secondary", whiteSpace: "nowrap", fontSize: 15 }}>
                          {rangeWithUnit}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* FOOTER — signature sits under results (print CSS removes large gap) */}
          <Box
            className="report-footer"
            sx={{
              mt: "auto",
              px: 5,
              pt: 2,
              pb: "5px",
              "@media print": { mt: "auto !important", pb: "5px !important" },
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
              <Box className="report-sign-block" sx={{ textAlign: "center", minWidth: 180 }}>
                {report.doctor?.signature_image ? (
                  <Box
                    component="img"
                    className="report-sign-image"
                    src={report.doctor.signature_image}
                    alt="Signature"
                    sx={{ height: 48, mb: 0.5, objectFit: "contain" }}
                  />
                ) : (
                  <Box sx={{ height: 48, mb: 0.5 }} />
                )}
                <Divider />
                <Typography className="report-sign-name" variant="body2" sx={{ fontWeight: 600, mt: 0.5, fontSize: 12 }}>
                  {report.doctor?.name || "Doctor"}
                </Typography>
                <Typography className="report-sign-role" variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                  Authorized Signatory
                </Typography>
              </Box>
            </Box>
            <Box sx={{ borderTop: "1px solid #e2e8f0", pt: 0.75, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                {lab?.footer_text || "This is a computer-generated report."}
              </Typography>
            </Box>
          </Box>
        </Box>
        );
      })}
    </Box>
  );
}
