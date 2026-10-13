"use client";

import React, { useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Alert, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, InputAdornment, FormControl, InputLabel, Select,
  MenuItem, Tabs, Tab, Divider, IconButton, Tooltip, Switch,
  FormControlLabel, Collapse,
} from "@mui/material";
import {
  AddOutlined, SearchOutlined, ScienceOutlined, ArrowBackOutlined, EditOutlined,
  DeleteOutlined, ExpandMoreOutlined, ExpandLessOutlined, AddCircleOutlined,
  RemoveCircleOutlined,
} from "@mui/icons-material";
import Sidebar from "@/components/Sidebar";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface TestParam {
  id?: number;
  name: string;
  unit: string | null;
  default_min: number | null;
  default_max: number | null;
  method: string | null;
  display_order: number;
}

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
  is_panel: boolean;
  parameters?: TestParam[];
}

const DEFAULT_CATEGORIES = ["Hematology", "Biochemistry", "Thyroid", "Urine", "Serology", "Vitamins", "Microbiology", "Hormones", "General"];
const SAMPLE_TYPES = ["Blood (EDTA)", "Blood (Fluoride)", "Serum", "Urine (Midstream)", "Urine (24hr)", "Blood", "Stool", "Sputum", "Swab"];
const REPORT_TIMES = ["30 Minutes", "1 Hour", "2 Hours", "Same Day", "Next Day", "2-3 Days", "1 Week"];

type ViewMode = "list" | "add" | "edit";

export default function DoctorTestsPage() {
  const { t } = useI18n();
  const [tests, setTests] = useState<TestDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [categoryTab, setCategoryTab] = useState("All");
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedPanels, setExpandedPanels] = useState<Set<number>>(new Set());

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
  const [isPanel, setIsPanel] = useState(false);
  const [parameters, setParameters] = useState<TestParam[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadTests = () =>
    apiRequest("/api/tests").then((r) => r.json()).then((d) => setTests(Array.isArray(d) ? d : []));

  useEffect(() => { loadTests(); }, []);

  function resetForm() {
    setName(""); setCategory(""); setSampleType(""); setMethod("");
    setPrice(""); setMin(""); setMax(""); setUnit(""); setReportTime("");
    setIsPanel(false); setParameters([]); setErrors({}); setEditingId(null);
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
    setIsPanel(test.is_panel);
    setParameters(test.parameters?.map((p, i) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      default_min: p.default_min,
      default_max: p.default_max,
      method: p.method,
      display_order: p.display_order ?? i + 1,
    })) || []);
    setEditingId(test.id);
    setErrors({});
    setView("edit");
  }

  function goBack() {
    setView("list");
    resetForm();
  }

  function addParameter() {
    setParameters((prev) => [
      ...prev,
      {
        name: "",
        unit: null,
        default_min: null,
        default_max: null,
        method: null,
        display_order: prev.length + 1,
      },
    ]);
  }

  function removeParameter(idx: number) {
    setParameters(parameters.filter((_, i) => i !== idx));
  }

  function updateParameter(idx: number, field: string, value: any) {
    setParameters(parameters.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function toggleExpand(id: number) {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Test name is required";
    if (!category) e.category = "Category is required";
    if (!sampleType) e.sampleType = "Sample type is required";
    if (!price || Number(price) <= 0) e.price = "Valid price is required";
    if (!isPanel && min && max && Number(min) > Number(max)) e.min = "Min cannot exceed max";
    if (isPanel && parameters.length === 0) e.parameters = "Panel must have at least one parameter";
    if (isPanel && parameters.some((p) => !p.name?.trim())) e.parameters = "All parameters must have a name";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    const payload: any = {
      name: name.trim(),
      category,
      sample_type: sampleType,
      method: method || null,
      price: Number(price),
      report_time: reportTime || null,
      is_panel: isPanel,
    };

    if (!isPanel) {
      payload.defaultMin = min ? Number(min) : null;
      payload.defaultMax = max ? Number(max) : null;
      payload.unit = unit || null;
    }

    if (isPanel) {
      payload.parameters = parameters.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit || null,
        defaultMin: p.default_min,
        defaultMax: p.default_max,
        method: p.method || null,
      }));
    }

    const url = editingId ? `/api/tests/${editingId}` : "/api/tests";
    const method2 = editingId ? "PUT" : "POST";

    const res = await apiRequest(url, { method: method2, body: JSON.stringify(payload) });
    const data = await res.json();

    if (res.ok) {
      setAlert({ type: "success", msg: editingId ? "Test updated successfully" : "Test created successfully" });
      goBack();
      loadTests();
    } else {
      setAlert({ type: "error", msg: data.error || "Failed to save test" });
    }
    setTimeout(() => setAlert(null), 3000);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this test? This cannot be undone.")) return;
    const res = await apiRequest(`/api/tests/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAlert({ type: "success", msg: "Test deleted" });
      loadTests();
    } else {
      setAlert({ type: "error", msg: "Failed to delete" });
    }
    setTimeout(() => setAlert(null), 3000);
  }

  const categories = ["All", ...new Set(tests.map((t) => t.category))];
  const filtered = tests.filter((t) => {
    const matchCat = categoryTab === "All" || t.category === categoryTab;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // LIST VIEW
  if (view === "list") {
    return (
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <Sidebar role="doctor" />
        <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }} id="main-content" tabIndex={-1}>
          {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Test Catalogue</Typography>
            <Button variant="contained" startIcon={<AddOutlined />} onClick={openAdd}>Add Test</Button>
          </Box>

          <TextField
            placeholder="Search tests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }}
          />

          <Tabs value={categoryTab} onChange={(_, v) => setCategoryTab(v)} variant="scrollable" sx={{ mb: 2 }}>
            {categories.map((c) => <Tab key={c} label={c} value={c} />)}
          </Tabs>

          <TableContainer component={Card}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 600, fontSize: 12, bgcolor: "#f8fafc" } }}>
                  <TableCell width={40}></TableCell>
                  <TableCell>Test Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Sample</TableCell>
                  <TableCell align="right">Price (₹)</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((test) => (
                  <React.Fragment key={test.id}>
                    <TableRow hover>
                      <TableCell>
                        {test.is_panel && (
                          <IconButton size="small" onClick={() => toggleExpand(test.id)}>
                            {expandedPanels.has(test.id) ? <ExpandLessOutlined fontSize="small" /> : <ExpandMoreOutlined fontSize="small" />}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>
                        {test.name}
                        {test.is_panel && (
                          <Chip label={`${test.parameters?.length || 0} params`} size="small" sx={{ ml: 1, fontSize: 10, height: 18 }} color="info" />
                        )}
                      </TableCell>
                      <TableCell><Chip label={test.category} size="small" variant="outlined" sx={{ fontSize: 11 }} /></TableCell>
                      <TableCell>
                        <Chip label={test.is_panel ? "Panel" : "Single"} size="small" color={test.is_panel ? "primary" : "default"} sx={{ fontSize: 10, height: 20 }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{test.sample_type}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>₹{test.price}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(test)}><EditOutlined fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(test.id)}><DeleteOutlined fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                    {/* Expanded panel parameters */}
                    {test.is_panel && expandedPanels.has(test.id) && test.parameters?.map((param) => (
                      <TableRow key={`param-${param.display_order}`} sx={{ bgcolor: "#f8fafc" }}>
                        <TableCell></TableCell>
                        <TableCell sx={{ pl: 5, fontSize: 12, color: "text.secondary" }}>↳ {param.name}</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{param.unit || "—"}</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>
                          {param.default_min != null && param.default_max != null ? `${param.default_min} – ${param.default_max}` : "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{param.method || "—"}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    );
  }

  // ADD/EDIT VIEW
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar role="doctor" />
      <Box sx={{ flexGrow: 1, p: 3, overflow: "auto" }} id="main-content" tabIndex={-1}>
        {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Button variant="outlined" size="small" startIcon={<ArrowBackOutlined />} onClick={goBack}>Back</Button>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{view === "add" ? "Add New Test" : "Edit Test"}</Typography>
        </Box>

        <Card>
          <CardContent>
            <Grid container spacing={2}>
              {/* Panel toggle */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch checked={isPanel} onChange={(e) => setIsPanel(e.target.checked)} color="primary" />}
                  label={<Typography sx={{ fontWeight: 600 }}>This is a Panel Test (contains multiple parameters)</Typography>}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField label="Test Name *" value={name} onChange={(e) => setName(e.target.value)} fullWidth error={!!errors.name} helperText={errors.name} />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth error={!!errors.category}>
                  <InputLabel>Category *</InputLabel>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)} label="Category *">
                    {DEFAULT_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth error={!!errors.sampleType}>
                  <InputLabel>Sample Type *</InputLabel>
                  <Select value={sampleType} onChange={(e) => setSampleType(e.target.value)} label="Sample Type *">
                    {SAMPLE_TYPES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="Method" value={method} onChange={(e) => setMethod(e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="Price (₹) *" type="number" value={price} onChange={(e) => setPrice(e.target.value)} fullWidth error={!!errors.price} helperText={errors.price} />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Report Time</InputLabel>
                  <Select value={reportTime} onChange={(e) => setReportTime(e.target.value)} label="Report Time">
                    <MenuItem value="">—</MenuItem>
                    {REPORT_TIMES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/* Single test fields */}
              {!isPanel && (
                <>
                  <Grid item xs={12} md={2}>
                    <TextField label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} fullWidth />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField label="Normal Min" type="number" value={min} onChange={(e) => setMin(e.target.value)} fullWidth error={!!errors.min} />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField label="Normal Max" type="number" value={max} onChange={(e) => setMax(e.target.value)} fullWidth />
                  </Grid>
                </>
              )}

              {/* Panel parameters */}
              {isPanel && (
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Panel Parameters ({parameters.length})
                    </Typography>
                    <Button startIcon={<AddCircleOutlined />} onClick={addParameter} variant="outlined" size="small">
                      Add Parameter
                    </Button>
                  </Box>
                  {errors.parameters && <Alert severity="error" sx={{ mb: 2 }}>{errors.parameters}</Alert>}

                  {parameters.map((param, idx) => (
                    <Box key={idx} sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "center", p: 1.5, bgcolor: "#f8fafc", borderRadius: 1 }}>
                      <Typography sx={{ fontSize: 12, color: "text.secondary", minWidth: 20 }}>{idx + 1}.</Typography>
                      <TextField
                        size="small" label="Parameter Name *" value={param.name}
                        onChange={(e) => updateParameter(idx, "name", e.target.value)}
                        sx={{ flex: 2 }}
                      />
                      <TextField
                        size="small" label="Unit" value={param.unit || ""}
                        onChange={(e) => updateParameter(idx, "unit", e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small" label="Min" type="number" value={param.default_min ?? ""}
                        onChange={(e) => updateParameter(idx, "default_min", e.target.value ? Number(e.target.value) : null)}
                        sx={{ width: 80 }}
                      />
                      <TextField
                        size="small" label="Max" type="number" value={param.default_max ?? ""}
                        onChange={(e) => updateParameter(idx, "default_max", e.target.value ? Number(e.target.value) : null)}
                        sx={{ width: 80 }}
                      />
                      <TextField
                        size="small" label="Method" value={param.method || ""}
                        onChange={(e) => updateParameter(idx, "method", e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <IconButton color="error" size="small" onClick={() => removeParameter(idx)}>
                        <RemoveCircleOutlined fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Grid>
              )}

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
                  <Button variant="outlined" onClick={goBack}>Cancel</Button>
                  <Button variant="contained" onClick={handleSubmit}>
                    {editingId ? "Update Test" : "Create Test"}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
