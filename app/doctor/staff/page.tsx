"use client";

import { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, TextField, Button,
  Alert, InputAdornment, IconButton, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Tooltip,
} from "@mui/material";
import {
  PersonAddOutlined, EmailOutlined, LockOutlined,
  VisibilityOutlined, VisibilityOffOutlined, DeleteOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";

interface StaffUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export default function StaffPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);

  const loadUsers = () =>
    apiRequest("/api/auth/users").then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : []));

  useEffect(() => { loadUsers(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, role: "compounder" }),
    });
    const data = await res.json();
    if (res.ok) {
      setAlert({ type: "success", msg: `Compounder account created for ${email}` });
      setEmail(""); setPassword("");
      loadUsers();
    } else {
      setAlert({ type: "error", msg: data.error || "Failed to create account." });
    }
    setTimeout(() => setAlert(null), 5000);
  }

  async function handleDelete(id: number, userEmail: string) {
    if (!confirm(`Delete staff account "${userEmail}"?`)) return;
    const res = await apiRequest(`/api/auth/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAlert({ type: "success", msg: `Deleted ${userEmail}` });
      loadUsers();
    } else {
      const d = await res.json();
      setAlert({ type: "error", msg: d.error || "Failed to delete." });
    }
    setTimeout(() => setAlert(null), 4000);
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="doctor" email="doctor@mylab.com" />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5">Staff Management</Typography>
          <Typography variant="body2" color="text.secondary">Manage lab staff accounts</Typography>
        </Box>

        {alert && <Alert severity={alert.type} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

        <Grid container spacing={3}>
          {/* Add Staff Form */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                  <PersonAddOutlined sx={{ color: "primary.main" }} />
                  <Typography variant="h6">Add Compounder</Typography>
                </Box>
                <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required fullWidth
                    InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment> }}
                  />
                  <TextField
                    label="Password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required fullWidth
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><LockOutlined sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPw(!showPw)}>
                            {showPw ? <VisibilityOffOutlined sx={{ fontSize: 18 }} /> : <VisibilityOutlined sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button type="submit" variant="contained" startIcon={<PersonAddOutlined />} fullWidth sx={{ mt: 0.5 }}>
                    Create Account
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Staff List */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ pb: 0 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>All Staff ({users.length})</Typography>
              </CardContent>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 600, color: "text.secondary", fontSize: 12, bgcolor: "#f8fafc" } }}>
                      <TableCell>Email</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Joined</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} hover sx={{ "& td": { fontSize: 13 } }}>
                        <TableCell sx={{ fontWeight: 500 }}>{u.email}</TableCell>
                        <TableCell>{u.name || <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                        <TableCell>
                          <Chip
                            label={u.role}
                            size="small"
                            color={u.role === "doctor" ? "primary" : "default"}
                            sx={{ fontSize: 11, height: 22 }}
                          />
                        </TableCell>
                        <TableCell>{new Date(u.createdAt).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell align="center">
                          {u.role !== "doctor" && (
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => handleDelete(u.id, u.email)}>
                                <DeleteOutlined sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                          No staff members yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
