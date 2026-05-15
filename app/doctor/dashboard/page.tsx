"use client";

import { useEffect, useState } from "react";
import {
  Box, Typography, Grid, Card, CardContent, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, Avatar,
} from "@mui/material";
import {
  ArticleOutlined, ScienceOutlined, TrendingUpOutlined, PeopleOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";

interface Report {
  id: number;
  date: string;
  patient_name: string;
  patient_age: number;
  referred_by: string | null;
  total_price: number;
  status: string;
}

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

export default function DoctorDashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("/api/reports")
      .then((r) => r.json())
      .then((data) => { setReports(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayReports = reports.filter((r) => r.date === today);
  const todayRevenue = todayReports.reduce((s, r) => s + r.total_price, 0);
  const totalRevenue = reports.reduce((s, r) => s + r.total_price, 0);

  const stats: StatCard[] = [
    { label: "Today's Reports", value: todayReports.length, icon: <ArticleOutlined />, color: "#0f4c81", bg: "#e8f0fe" },
    { label: "Today's Revenue", value: `₹${todayRevenue.toFixed(0)}`, icon: <TrendingUpOutlined />, color: "#00897b", bg: "#e0f2f1" },
    { label: "Total Reports", value: reports.length, icon: <PeopleOutlined />, color: "#7b1fa2", bg: "#f3e5f5" },
    { label: "Total Revenue", value: `₹${totalRevenue.toFixed(0)}`, icon: <ScienceOutlined />, color: "#e65100", bg: "#fff3e0" },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="doctor" email="doctor@mylab.com" />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5">Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </Typography>
        </Box>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {stats.map((s) => (
            <Grid item xs={12} sm={6} lg={3} key={s.label}>
              <Card>
                <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 2.5 }}>
                  <Avatar sx={{ bgcolor: s.bg, color: s.color, width: 48, height: 48 }}>
                    {s.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: s.color }}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Recent Reports */}
        <Card>
          <CardContent sx={{ pb: 0 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent Reports</Typography>
          </CardContent>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 600, color: "text.secondary", fontSize: 12, bgcolor: "#f8fafc" } }}>
                    <TableCell>ID</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Age</TableCell>
                    <TableCell>Referred By</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.slice(0, 20).map((r) => (
                    <TableRow key={r.id} hover sx={{ "& td": { fontSize: 13 } }}>
                      <TableCell sx={{ color: "text.secondary" }}>#{r.id}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{r.patient_name}</TableCell>
                      <TableCell>{r.patient_age} yrs</TableCell>
                      <TableCell>{r.referred_by || "—"}</TableCell>
                      <TableCell>{new Date(r.date).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: "#00897b" }}>₹{r.total_price.toFixed(0)}</TableCell>
                      <TableCell>
                        <Chip label={r.status} size="small"
                          color={r.status === "finalized" ? "success" : "default"}
                          sx={{ fontSize: 11, height: 22 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {reports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        No reports yet
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
