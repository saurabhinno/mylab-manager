import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { requireAuth } from "@/lib/auth";
import { getUserIdFromCookie } from "@/lib/session";
import { parseAstm, looksLikeAstm, normalizeInstrumentPayload } from "@/lib/astm";
import { parseHl7, looksLikeHl7 } from "@/lib/hl7";
import {
  ANALYZER_PROFILES,
  getProfile,
  convertAnalyzerValueToLab,
  matchCatalogueName,
  normalizeTestName,
  expandMidCellResults,
} from "@/lib/analyzerMaps";
import { AnalyzerInbox } from "@/models/AnalyzerInbox";
import { Report } from "@/models/Report";
import { ReportItem } from "@/models/ReportItem";
import { TestDefinition } from "@/models/TestDefinition";
import { User } from "@/models/User";
import {
  allocateTodayReportNumber,
  findReportBySampleOrId,
  todayDateOnly,
} from "@/lib/dailyReportNumber";
import { looksLikeClinitek, parseClinitek, parseClinitekAstm } from "@/lib/clinitek";

const router = Router();

function loadCodeMap(profileId: string): Record<string, string> {
  return getProfile(profileId).codes;
}

function normalizeKey(s: string) {
  // Cellenium emits RDW_CV / PDW_SD; catalogue uses RDW-CV etc.
  return s.trim().toUpperCase().replace(/[\s_\-]/g, "");
}

function isNoiseCode(code: string) {
  return /histogram|scatter|flag/i.test(code);
}

function mapResults(
  results: { code: string; value: string; unit: string | null }[],
  codeMap: Record<string, string>
) {
  const mapped: {
    code: string;
    testName: string | null;
    value: string;
    unit: string | null;
  }[] = [];
  for (const r of results) {
    if (isNoiseCode(r.code)) continue;
    const key = normalizeKey(r.code);
    let testName: string | null = null;
    for (const [k, v] of Object.entries(codeMap)) {
      if (normalizeKey(k) === key) {
        testName = v;
        break;
      }
    }
    mapped.push({
      code: r.code,
      testName,
      value: r.value,
      unit: r.unit,
    });
  }
  // 3-part MID/MXD → Eosinophil 70% / Monocyte 25% / Basophil 5%
  return expandMidCellResults(mapped);
}

async function applyMappedToReport(
  report: Report,
  mapped: {
    testName: string | null;
    value: string;
    unit?: string | null;
    derivedFromMid?: boolean;
  }[],
  onlyEmpty = false
) {
  const full = await Report.findByPk(report.id, {
    include: [{ model: ReportItem, as: "reportItems" }],
  });
  if (!full) return 0;
  const items = (full as any).reportItems as ReportItem[];
  const itemNames = items.map((it) => it.test_name);
  let applied = 0;
  // Prefer first mapped value per resolved item (avoids P-LCC overwriting PLT).
  const seen = new Set<number>();
  for (const m of mapped) {
    if (!m.testName || m.value === "") continue;
    const matchedName = matchCatalogueName(itemNames, m.testName);
    if (!matchedName) continue;
    const target = items.find((it) => it.test_name === matchedName);
    if (!target || seen.has(target.id)) continue;
    if (onlyEmpty && String(target.result_value || "").trim()) continue;
    const converted = convertAnalyzerValueToLab(
      target.test_name,
      String(m.value),
      m.unit,
      target.unit
    );
    target.result_value = converted;
    target.result_type = /^-?\d+(\.\d+)?$/.test(converted) ? "numeric" : "text";
    if (m.derivedFromMid) {
      target.note = "Derived from MID (Eos 70% / Mono 25% / Bas 5%)";
    }
    await target.save();
    applied++;
    seen.add(target.id);
  }
  full.status = "results_entered";
  await full.save();
  return applied;
}

/** Resolve CBC panel even if the catalogue name was recreated (spacing/punctuation). */
async function findCbcPanel() {
  const panels = await TestDefinition.findAll({
    where: { is_panel: true },
    include: [{ model: TestDefinition, as: "parameters" }],
  });
  if (!panels.length) return null;

  const score = (name: string) => {
    const n = normalizeTestName(name);
    if (n === "completebloodcountcbc" || n === "cbc") return 100;
    if (n.includes("completebloodcount") && n.includes("cbc")) return 90;
    if (n.includes("cbc")) return 80;
    if (n.includes("completebloodcount")) return 70;
    return 0;
  };

  const ranked = [...panels]
    .map((p) => ({ p, s: score(p.name) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.p.id - a.p.id);

  return ranked[0]?.p || null;
}

async function findUrinePanel() {
  const panels = await TestDefinition.findAll({
    where: { is_panel: true },
    include: [{ model: TestDefinition, as: "parameters" }],
  });
  const score = (name: string) => {
    const n = normalizeTestName(name);
    if (n.includes("urineroutine")) return 100;
    if (n.includes("urine") && n.includes("micro")) return 90;
    if (n.includes("urine")) return 70;
    return 0;
  };
  const ranked = [...panels]
    .map((p) => ({ p, s: score(p.name) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.p.id - a.p.id);
  return ranked[0]?.p || null;
}

function looksLikeClinitekAstm(raw: string): boolean {
  return /Siemens Healthcare Diagnostics/i.test(raw);
}

function instrumentPayload(raw: string, profileId: string) {
  const cleaned = normalizeInstrumentPayload(raw);
  if (
    profileId === "clinitek-status" ||
    looksLikeClinitek(cleaned) ||
    looksLikeClinitekAstm(cleaned)
  ) {
    const parsed =
      looksLikeClinitek(cleaned) && !looksLikeClinitekAstm(cleaned)
        ? parseClinitek(cleaned)
        : parseClinitekAstm(cleaned);
    return { format: "clinitek" as const, parsed, cleaned };
  }
  const format = looksLikeHl7(cleaned)
    ? ("hl7" as const)
    : looksLikeAstm(cleaned)
      ? ("astm" as const)
      : ("unknown" as const);
  const parsed = format === "hl7" ? parseHl7(cleaned) : parseAstm(cleaned);
  return { format, parsed, cleaned };
}

async function createCbcReportFromInbox(
  row: AnalyzerInbox,
  opts: {
    patient_name?: string | null;
    age?: number;
    gender?: string | null;
    phone?: string | null;
    referred_by?: string | null;
  },
  actor: User
) {
  const cbc = await findCbcPanel();
  if (!cbc) {
    throw new Error(
      "CBC panel not found in catalogue. Add a panel named like Complete Blood Count (CBC)."
    );
  }

  const doctor =
    actor.role === "doctor"
      ? actor
      : await User.findOne({ where: { role: "doctor" } });
  if (!doctor) {
    throw new Error("No doctor account configured");
  }

  const patientName =
    String(opts.patient_name || row.patient_name || "Unknown").trim() ||
    "Unknown";

  const { date, daily_number } = await allocateTodayReportNumber();
  const report = await Report.create({
    date,
    daily_number,
    patient_name: patientName,
    patient_age: Number(opts.age) || 0,
    patient_weight: 0,
    patient_gender: opts.gender || null,
    patient_phone: opts.phone || null,
    referred_by: opts.referred_by || null,
    total_price: cbc.price,
    payment_status: "unpaid",
    status: "sample_collected",
    sample_collected_at: new Date(),
    compounder_id: actor.id,
    doctor_id: doctor.id,
  });

  const params = ((cbc as any).parameters || []) as TestDefinition[];
  const ordered = [...params].sort(
    (a, b) => (a.display_order || 0) - (b.display_order || 0)
  );
  for (let i = 0; i < ordered.length; i++) {
    const param = ordered[i];
    await ReportItem.create({
      report_id: report.id,
      test_definition_id: param.id,
      test_name: param.name,
      sample_type: param.sample_type || cbc.sample_type || null,
      result_type: "numeric",
      result_value: "",
      unit: param.unit || null,
      normal_min: param.default_min,
      normal_max: param.default_max,
      note: null,
      price: 0,
      panel_name: cbc.name,
      display_order: i + 1,
    });
  }

  let mapped =
    (JSON.parse(row.parsed_json || "{}") as {
      mapped?: { testName: string | null; value: string }[];
    }).mapped || [];

  if (row.raw) {
    const profileId = row.profile_id || "cellenium-21";
    const pack = instrumentPayload(row.raw, profileId);
    const mapProfile =
      pack.format === "clinitek" ? "clinitek-status" : profileId;
    mapped = mapResults(pack.parsed.results, loadCodeMap(mapProfile));
    row.parsed_json = JSON.stringify({
      format: pack.format,
      parsed: pack.parsed,
      mapped,
    });
  }

  const applied = await applyMappedToReport(report, mapped);
  row.status = "applied";
  row.applied_report_id = report.id;
  await row.save();

  return {
    report_id: report.id,
    daily_number: report.daily_number,
    applied,
    patient_name: patientName,
    mapped_count: mapped.filter((m) => m.testName).length,
  };
}

function samePatientName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(a) === norm(b) && norm(a).length > 0;
}

/** Today's report for this patient that already includes the urine panel. */
async function findTodayUrineReport(patientName: string) {
  const reports = await Report.findAll({
    where: { date: todayDateOnly() },
    include: [{ model: ReportItem, as: "reportItems" }],
  });
  return (
    reports.find((report) => {
      if (!samePatientName(report.patient_name || "", patientName)) return false;
      const items = ((report as any).reportItems || []) as ReportItem[];
      return items.some((item) => /urine/i.test(item.panel_name || ""));
    }) || null
  );
}

async function createUrineReportFromInbox(
  row: AnalyzerInbox,
  opts: {
    patient_name?: string | null;
    age?: number;
    gender?: string | null;
    phone?: string | null;
    referred_by?: string | null;
  },
  actor: User
) {
  const panel = await findUrinePanel();
  if (!panel) {
    throw new Error(
      "Urine panel not found. Add a panel named like Urine Routine & Microscopy."
    );
  }

  const doctor =
    actor.role === "doctor"
      ? actor
      : await User.findOne({ where: { role: "doctor" } });
  if (!doctor) throw new Error("No doctor account configured");

  const patientName =
    String(opts.patient_name || row.patient_name || "Unknown").trim() ||
    "Unknown";

  let mapped =
    (JSON.parse(row.parsed_json || "{}") as {
      mapped?: { testName: string | null; value: string }[];
    }).mapped || [];
  if (row.raw) {
    const pack = instrumentPayload(row.raw, "clinitek-status");
    mapped = mapResults(pack.parsed.results, loadCodeMap("clinitek-status"));
    row.parsed_json = JSON.stringify({
      format: pack.format,
      parsed: pack.parsed,
      mapped,
    });
  }

  const existing = await findTodayUrineReport(patientName);
  if (existing) {
    const applied = await applyMappedToReport(existing, mapped, true);
    row.status = "applied";
    row.applied_report_id = existing.id;
    row.profile_id = "clinitek-status";
    await row.save();
    return {
      report_id: existing.id,
      daily_number: existing.daily_number,
      applied,
      patient_name: existing.patient_name,
      mapped_count: mapped.filter((m) => m.testName).length,
      existing: true,
    };
  }

  const { date, daily_number } = await allocateTodayReportNumber();
  const report = await Report.create({
    date,
    daily_number,
    patient_name: patientName,
    patient_age: Number(opts.age) || 0,
    patient_weight: 0,
    patient_gender: opts.gender || null,
    patient_phone: opts.phone || null,
    referred_by: opts.referred_by || null,
    total_price: panel.price,
    payment_status: "unpaid",
    status: "sample_collected",
    sample_collected_at: new Date(),
    compounder_id: actor.id,
    doctor_id: doctor.id,
  });

  const params = ((panel as any).parameters || []) as TestDefinition[];
  const ordered = [...params].sort(
    (a, b) => (a.display_order || 0) - (b.display_order || 0)
  );
  for (let i = 0; i < ordered.length; i++) {
    const param = ordered[i];
    await ReportItem.create({
      report_id: report.id,
      test_definition_id: param.id,
      test_name: param.name,
      sample_type: param.sample_type || panel.sample_type || null,
      result_type: "text",
      result_value: "",
      unit: param.unit || null,
      normal_min: param.default_min,
      normal_max: param.default_max,
      note: null,
      price: 0,
      panel_name: panel.name,
      display_order: i + 1,
    });
  }

  const applied = await applyMappedToReport(report, mapped);
  row.status = "applied";
  row.applied_report_id = report.id;
  row.profile_id = "clinitek-status";
  await row.save();

  return {
    report_id: report.id,
    daily_number: report.daily_number,
    applied,
    patient_name: patientName,
    mapped_count: mapped.filter((m) => m.testName).length,
  };
}

export async function importClinitekMessage(raw: string, actor: User) {
  const pack = instrumentPayload(raw, "clinitek-status");
  const testedAt = (pack.parsed as { testedAt?: string | null }).testedAt;
  if (testedAt && testedAt !== todayDateOnly()) {
    return { skipped: "not-today" as const };
  }
  const mapped = mapResults(pack.parsed.results, loadCodeMap("clinitek-status"));
  if (!mapped.some((m) => m.testName && m.value !== "")) {
    return { skipped: "no-values" as const };
  }
  const row = await AnalyzerInbox.create({
    machine_path: "COM6",
    sample_id: pack.parsed.sampleId,
    patient_name: pack.parsed.patientName,
    profile_id: "clinitek-status",
    raw,
    parsed_json: JSON.stringify({
      format: pack.format,
      parsed: pack.parsed,
      mapped,
    }),
    status: "new",
    received_at: new Date(),
  });
  const created = await createUrineReportFromInbox(
    row,
    { patient_name: pack.parsed.patientName },
    actor
  );
  return { skipped: null, ...created };
}

router.use(requireAuth);

router.get("/profiles", (_req: Request, res: Response) => {
  return res.json(
    ANALYZER_PROFILES.map((p) => ({
      id: p.id,
      label: p.label,
      defaultBaud: p.defaultBaud,
      protocolHint: p.protocolHint,
    }))
  );
});

router.post("/parse", async (req: Request, res: Response) => {
  try {
    const raw = String(req.body?.raw || "");
    if (!raw.trim()) {
      return res.status(400).json({ error: "raw required" });
    }
    const profileId = String(req.body?.profile_id || "cellenium-21");
    const pack = instrumentPayload(raw, profileId);
    const mapProfile =
      pack.format === "clinitek" ? "clinitek-status" : profileId;
    return res.json({
      format: pack.format,
      looksLikeAstm: pack.format === "astm",
      looksLikeHl7: pack.format === "hl7",
      parsed: pack.parsed,
      mapped: mapResults(pack.parsed.results, loadCodeMap(mapProfile)),
      profile_id: mapProfile,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Parse failed" });
  }
});

router.get("/inbox", async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "new";
    const where =
      status === "all" ? {} : { status: status as "new" | "applied" | "ignored" };
    const rows = await AnalyzerInbox.findAll({
      where,
      order: [["received_at", "DESC"]],
      limit: 100,
    });
    return res.json(rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/inbox", async (req: Request, res: Response) => {
  try {
    const raw = String(req.body?.raw || "");
    if (!raw.trim()) {
      return res.status(400).json({ error: "raw required" });
    }
    const profileId = String(req.body?.profile_id || "cellenium-21");
    const machinePath = req.body?.machine_path
      ? String(req.body.machine_path)
      : null;
    const autoCreate = req.body?.auto_create_report !== false;
    const pack = instrumentPayload(raw, profileId);
    const mapProfile =
      pack.format === "clinitek" ? "clinitek-status" : profileId;
    const mapped = mapResults(pack.parsed.results, loadCodeMap(mapProfile));

    const row = await AnalyzerInbox.create({
      machine_path: machinePath,
      sample_id: pack.parsed.sampleId,
      patient_name: pack.parsed.patientName,
      profile_id: mapProfile,
      raw,
      parsed_json: JSON.stringify({
        format: pack.format,
        parsed: pack.parsed,
        mapped,
      }),
      status: "new",
      received_at: new Date(),
    });

    const hasValues = mapped.some((m) => m.testName && m.value !== "");
    const testedAt = (pack.parsed as { testedAt?: string | null }).testedAt;
    const isToday = !testedAt || testedAt === todayDateOnly();
    const actor = (req as any).user as User | undefined;
    if (autoCreate && hasValues && isToday && actor) {
        try {
          const created =
            pack.format === "clinitek"
              ? await createUrineReportFromInbox(
                  row,
                  {
                    patient_name: pack.parsed.patientName,
                    age: req.body?.age,
                    gender: req.body?.gender,
                    phone: req.body?.phone,
                  },
                  actor
                )
              : await createCbcReportFromInbox(
                  row,
                  {
                    patient_name: pack.parsed.patientName,
                    age: req.body?.age,
                    gender: req.body?.gender,
                    phone: req.body?.phone,
                  },
                  actor
                );
          await row.reload();
          return res.json({
            ...row.toJSON(),
            report_id: created.report_id,
            applied: created.applied,
            auto_created: true,
          });
        } catch (err) {
          console.error("Auto-create report failed", err);
        }
    }

    return res.json(row);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to save inbox item" });
  }
});

router.post("/inbox/:id/ignore", async (req: Request, res: Response) => {
  try {
    const row = await AnalyzerInbox.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    row.status = "ignored";
    await row.save();
    return res.json(row);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/inbox/:id/apply", async (req: Request, res: Response) => {
  try {
    const row = await AnalyzerInbox.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });

    let report: Report | null = null;
    if (req.body?.report_id) {
      report = await Report.findByPk(Number(req.body.report_id), {
        include: [{ model: ReportItem, as: "reportItems" }],
      });
    } else if (row.sample_id && /^\d+$/.test(row.sample_id.trim())) {
      // Machine sample id = today's day-wise report number
      report = await findReportBySampleOrId(Number(row.sample_id.trim()), true);
    }

    if (!report) {
      return res.status(400).json({
        error:
          "report_id required (or set sample id on the machine to today's report number)",
      });
    }
    if (report.status === "finalized") {
      return res.status(400).json({ error: "Report is finalized" });
    }

    const payload = JSON.parse(row.parsed_json || "{}") as {
      mapped?: { testName: string | null; value: string }[];
    };
    const mapped = payload.mapped || [];
    const applied = await applyMappedToReport(report, mapped);

    row.status = "applied";
    row.applied_report_id = report.id;
    await row.save();

    return res.json({
      success: true,
      applied,
      report_id: report.id,
      daily_number: report.daily_number,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Apply failed" });
  }
});

/**
 * Create a new CBC report from an inbox row and prefill mapped results.
 * Body (optional): { patient_name?, age?, gender?, phone? }
 */
router.post("/inbox/:id/create-report", async (req: Request, res: Response) => {
  try {
    const row = await AnalyzerInbox.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.status === "applied") {
      return res.status(400).json({ error: "Inbox item already applied" });
    }

    const userId = getUserIdFromCookie(req.cookies);
    const actor = userId ? await User.findByPk(userId) : null;
    if (!actor) return res.status(401).json({ error: "Not authenticated" });

    const urine =
      row.profile_id === "clinitek-status" || looksLikeClinitek(row.raw || "");
    const created = urine
      ? await createUrineReportFromInbox(
          row,
          {
            patient_name: req.body?.patient_name,
            age: req.body?.age,
            gender: req.body?.gender,
            phone: req.body?.phone,
            referred_by: req.body?.referred_by,
          },
          actor
        )
      : await createCbcReportFromInbox(
          row,
          {
            patient_name: req.body?.patient_name,
            age: req.body?.age,
            gender: req.body?.gender,
            phone: req.body?.phone,
            referred_by: req.body?.referred_by,
          },
          actor
        );

    return res.json({ success: true, ...created });
  } catch (error: any) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error?.message || "Create report failed" });
  }
});

/** Pending reports for apply dropdown */
router.get("/pending-reports", async (_req: Request, res: Response) => {
  try {
    const reports = await Report.findAll({
      where: {
        status: { [Op.in]: ["sample_collected", "results_entered"] },
      },
      order: [["id", "DESC"]],
      limit: 50,
      attributes: [
        "id",
        "patient_name",
        "date",
        "status",
        "sample_collected_at",
      ],
    });
    return res.json(reports);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
