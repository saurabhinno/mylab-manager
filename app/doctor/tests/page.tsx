"use client";

import { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Alert, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, InputAdornment, FormControl, InputLabel, Select,
  MenuItem, Tabs, Tab, Divider, IconButton, Tooltip, Autocomplete,
} from "@mui/material";
import {
  AddOutlined, SearchOutlined, ScienceOutlined, ArrowBackOutlined, EditOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";

interface TestDefinition {
  id: number;
  name: string;
  category: string;
  sample_type: string;
  method: string | null;
  default_min: number | null;
  default_max: number | null;
  unit: string | null;
  price: number;
  report_time: string | null;
}

const DEFAULT_CATEGORIES = ["Hematology", "Biochemistry", "Thyroid", "Urine", "Serology", "Vitamins", "Microbiology", "Hormones", "General"];
const SAMPLE_TYPES = ["Blood (EDTA)", "Blood (Fluoride)", "Serum", "Urine (Midstream)", "Urine (24hr)", "Blood", "Stool", "Sputum", "Swab"];
const REPORT_TIMES = ["30 Minutes", "1 Hour", "2 Hours", "Same Day", "Next Day", "2-3 Days", "1 Week"];

type ViewMode = "list" | "add" | "edit";

export default function DoctorTestsPage() {
  const [tests, setTests] = useState<TestDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [categoryTab, setCategoryTab] = useState("All");
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [method, setMethod] = useState("");
  const [price, setPrice] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [unit, setUnit] = useState("");
  const [reportTime, setReportTime] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadTests = () =>
    apiRequest("/api/tests").then((r) => r.json()).then((d) => setTests(Array.isArray(d) ? d : []));

  useEffect(() => { loadTests(); }, []);

  function resetForm() {
    setName(""); setCategory(""); setSampleType(""); setMethod("");
    setPrice(""); setMin(""); setMax(""); setUnit(""); setReportTime("");
    setErrors({}); setEditingId(null);
  }

  function openAdd() {
    resetForm();
    setView("add");
  }

  function openEdit(test: TestDefinition) {
    setName(test.name);
    setCategory(test.category);
    setSampleType(test.sample_type);
    setMethod(test.method || "");
    setPrice(String(test.price));
    setMin(test.default_min != null ? String(test.default_min) : "");
    setMax(test.default_max != null ? String(test.default_max) : "");
    setUnit(test.unit || "");
    setReportTime(test.report_time || "");
    setEditingId(test.id);
    setErrors({});
    setView("edit");
  }

  function goBack() {
    setView("list");
    resetForm();
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Test name is required";
    if (!category) e.category = "Select a category";
    if (!sampleType) e.sampleType = "Select sample type";
    if (!price || Number(price) <= 0) e.price = "Enter a valid price";
    if (min && max && Number(min) > Number(max)) e.min = "Min cannot be greater than Max";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: name.trim(), category, sample_type: sampleType, method: method || null,
      defaultMin: min ? Number(min) : null, defaultMax: max ? Number(max) : null,
      unit: unit || null, price: Number(price), report_time: reportTime || null,
    };

    let res;
    if (view === "edit" && editingId) {
      res = await apiRequest(`/api/tests/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      res = await apiRequest("/api/tests", { method: "POST", body: JSON.stringify(payload) });
    }

    if (res.ok) {
      setAlert({ type: "success", msg: view === "edit" ? `"${name}" updated.` : `"${name}" added to catalogue.` });
      await loadTests();
      goBack();
    } else {
      const d = await res.json();
      setAlert({ type: "error", msg: d.error || "Failed to save test." });
    }
    setTimeout(() => setAlert(null), 4000);
  }

  // Dynamic categories: merge defaults + any from existing tests
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...tests.map((t) => t.category)])).sort();

  // Categories for tab filter
  const categories = ["All", ...Array.from(new Set(tests.map((t) => t.category))).sort()];

  const filtered = tests.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryTab === "All" || t.category === categoryTab;
    return matchesSearch && matchesCategory;
  });

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="doctor" email="doctor@mylab.com" />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }} id="main-content" tabIndex={-1}>
        {alert && <Alert severity={alert.type} sx={{ mb: 2, borderRadius: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

        {/* LIST VIEW */}
        {view === "list" && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
              <Box>
                <Typography variant="h5">Test Catalogue</Typography>
                <Typography variant="body2" color="text.secondary">
                  {tests.length} tests across {categories.length - 1} categories
                </Typography>
              </Box>
              <Button variant="contained" startIcon={<AddOutlined />} onClick={openAdd}>
                Add Test
              </Button>
            </Box>

            <Card>
              <CardContent sx={{ pb: 0 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Tabs
                    value={categoryTab}
                    onChange={(_, v) => setCategoryTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ "& .MuiTab-root": { textTransform: "none", fontSize: 13, minHeight: 36, py: 0 } }}
                  >
                    {categories.map((c) => <Tab key={c} label={c} value={c} />)}
                  </Tabs>
                  <TextField
                    placeholder="Search…"
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ width: 200, ml: 2 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined sx={{ fontSize: 16 }} /></InputAdornment> }}
                  />
                </Box>
              </CardContent>

              <TableContainer sx={{ maxHeight: "calc(100vh - 240px)" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 600, color: "text.secondary", fontSize: 11, bgcolor: "#f8fafc" } }}>
                      <TableCell>Test Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Sample</TableCell>
                      <TableCell>Normal Range</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>TAT</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="center" sx={{ width: 50 }}>Edit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id} hover sx={{ "& td": { fontSize: 12 } }}>
                        <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                        <TableCell>
                          <Chip label={t.category} size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                        </TableCell>
                        <TableCell>{t.sample_type}</TableCell>
                        <TableCell>
                          {t.default_min != null && t.default_max != null
                            ? `${t.default_min}–${t.default_max} ${t.unit || ""}`
                            : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>{t.method || "—"}</TableCell>
                        <TableCell>{t.report_time || "—"}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: "#00897b" }}>₹{t.price.toFixed(0)}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(t)} aria-label={`Edit test ${t.name}`}>
                              <EditOutlined sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 5, color: "text.secondary" }}>
                          {search || categoryTab !== "All" ? "No tests match your filters" : "No tests added yet"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </>
        )}

        {/* ADD / EDIT VIEW */}
        {(view === "add" || view === "edit") && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
              <Button variant="outlined" size="small" startIcon={<ArrowBackOutlined />} onClick={goBack}>
                Back
              </Button>
              <Typography variant="h5">{view === "edit" ? "Edit Test" : "Add New Test"}</Typography>
            </Box>

            <Card sx={{ maxWidth: 640 }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                  <ScienceOutlined sx={{ color: "primary.main" }} />
                  <Typography variant="h6">{view === "edit" ? "Update Test Details" : "Test Details"}</Typography>
                </Box>

                <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  {/* Test Name */}
                  <TextField
                    label="Test Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required fullWidth
                    placeholder="e.g. Complete Blood Count (CBC)"
                    error={!!errors.name}
                    helperText={errors.name}
                  />

                  <Grid container spacing={2}>
                    {/* Category */}
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        freeSolo
                        options={allCategories}
                        value={category}
                        onChange={(_, val) => setCategory(val || "")}
                        onInputChange={(_, val) => setCategory(val || "")}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Category"
                            required
                            error={!!errors.category}
                            helperText={errors.category || "Select or type a new category"}
                            placeholder="e.g. Hematology"
                          />
                        )}
                      />
                    </Grid>

                    {/* Sample Type */}
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth required error={!!errors.sampleType}>
                        <InputLabel>Sample Type</InputLabel>
                        <Select value={sampleType} onChange={(e) => setSampleType(e.target.value)} label="Sample Type">
                          {SAMPLE_TYPES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </Select>
                        {errors.sampleType && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.sampleType}</Typography>}
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Method */}
                  <TextField
                    label="Method / Technique"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    fullWidth
                    placeholder="e.g. CLIA, Enzymatic, Microscopy"
                    helperText="Testing methodology used (optional)"
                  />

                  <Grid container spacing={2}>
                    {/* Price */}
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Price"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required fullWidth
                        inputProps={{ min: 0 }}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                        error={!!errors.price}
                        helperText={errors.price}
                      />
                    </Grid>

                    {/* Report Time */}
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Report Time (TAT)</InputLabel>
                        <Select value={reportTime} onChange={(e) => setReportTime(e.target.value)} label="Report Time (TAT)">
                          <MenuItem value="">Not specified</MenuItem>
                          {REPORT_TIMES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Divider />
                  <Typography variant="subtitle2" color="text.secondary">Normal Reference Range (optional)</Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <TextField
                        label="Min Value"
                        type="number"
                        value={min}
                        onChange={(e) => setMin(e.target.value)}
                        fullWidth
                        error={!!errors.min}
                        helperText={errors.min}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        label="Max Value"
                        type="number"
                        value={max}
                        onChange={(e) => setMax(e.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        label="Unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        fullWidth
                        placeholder="g/dL, mg/dL"
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
                    <Button type="submit" variant="contained" startIcon={view === "edit" ? <EditOutlined /> : <AddOutlined />} sx={{ px: 4 }}>
                      {view === "edit" ? "Update Test" : "Add Test"}
                    </Button>
                    <Button variant="outlined" onClick={goBack}>
                      Cancel
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </Box>
  );
}
