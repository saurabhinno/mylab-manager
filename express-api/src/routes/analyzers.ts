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
} from "@/lib/analyzerMaps";
import { AnalyzerInbox } from "@/models/AnalyzerInbox";
import { Report } from "@/models/Report";
import { ReportItem } from "@/models/ReportItem";
import { TestDefinition } from "@/models/TestDefinition";
import { User } from "@/models/User";

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
  const mapped: { code: string; testName: string | null; value: string; unit: string | null }[] =
    [];
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
  return mapped;
}

async function applyMappedToReport(
  report: Report,
  mapped: { testName: string | null; value: string; unit?: string | null }[]
) {
  const full = await Report.findByPk(report.id, {
    include: [{ model: ReportItem, as: "reportItems" }],
  });
  if (!full) return 0;
  const items = (full as any).reportItems as ReportItem[];
  let applied = 0;
  // Prefer first mapped value per test name (avoids P-LCC overwriting PLT, etc.).
  const seen = new Set<string>();
  for (const m of mapped) {
    if (!m.testName || m.value === "") continue;
    const key = m.testName.trim().toLowerCase();
    if (seen.has(key)) continue;
    const target = items.find((it) => it.test_name.trim().toLowerCase() === key);
    if (target) {
      target.result_value = convertAnalyzerValueToLab(
        m.testName,
        String(m.value),
        m.unit
      );
      target.result_type = "numeric";
      await target.save();
      applied++;
      seen.add(key);
    }
  }
  full.status = "results_entered";
  await full.save();
  return applied;
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
  const cbc = await TestDefinition.findOne({
    where: { name: "Complete Blood Count (CBC)", is_panel: true },
    include: [{ model: TestDefinition, as: "parameters" }],
  });
  if (!cbc) {
    throw new Error("CBC panel not found in catalogue");
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

  const report = await Report.create({
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
  for (const param of ordered) {
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
    });
  }

  let mapped =
    (JSON.parse(row.parsed_json || "{}") as {
      mapped?: { testName: string | null; value: string }[];
    }).mapped || [];

  if (row.raw) {
    const profileId = row.profile_id || "cellenium-21";
    const cleaned = normalizeInstrumentPayload(row.raw);
    const format = looksLikeHl7(cleaned)
      ? "hl7"
      : looksLikeAstm(cleaned)
        ? "astm"
        : "unknown";
    const parsed = format === "hl7" ? parseHl7(cleaned) : parseAstm(cleaned);
    mapped = mapResults(parsed.results, loadCodeMap(profileId));
    row.parsed_json = JSON.stringify({ format, parsed, mapped });
  }

  const applied = await applyMappedToReport(report, mapped);
  row.status = "applied";
  row.applied_report_id = report.id;
  await row.save();

  return {
    report_id: report.id,
    applied,
    patient_name: patientName,
    mapped_count: mapped.filter((m) => m.testName).length,
  };
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
    const cleaned = normalizeInstrumentPayload(raw);
    const format = looksLikeHl7(cleaned)
      ? "hl7"
      : looksLikeAstm(cleaned)
        ? "astm"
        : "unknown";
    const parsed = format === "hl7" ? parseHl7(cleaned) : parseAstm(cleaned);
    const codeMap = loadCodeMap(profileId);
    return res.json({
      format,
      looksLikeAstm: format === "astm",
      looksLikeHl7: format === "hl7",
      parsed,
      mapped: mapResults(parsed.results, codeMap),
      profile_id: profileId,
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
    // Default: auto-create CBC report so results appear on the reports list.
    const autoCreate = req.body?.auto_create_report !== false;
    const cleaned = normalizeInstrumentPayload(raw);
    const format = looksLikeHl7(cleaned)
      ? "hl7"
      : looksLikeAstm(cleaned)
        ? "astm"
        : "unknown";
    const parsed = format === "hl7" ? parseHl7(cleaned) : parseAstm(cleaned);
    const codeMap = loadCodeMap(profileId);
    const mapped = mapResults(parsed.results, codeMap);

    const row = await AnalyzerInbox.create({
      machine_path: machinePath,
      sample_id: parsed.sampleId,
      patient_name: parsed.patientName,
      profile_id: profileId,
      raw,
      parsed_json: JSON.stringify({ format, parsed, mapped }),
      status: "new",
      received_at: new Date(),
    });

    const hasCbcValues = mapped.some((m) => m.testName && m.value !== "");
    if (autoCreate && hasCbcValues) {
      const userId = getUserIdFromCookie(req.cookies);
      const actor = userId ? await User.findByPk(userId) : null;
      if (actor) {
        try {
          const created = await createCbcReportFromInbox(
            row,
            {
              patient_name: parsed.patientName,
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
          console.error("Auto-create CBC report failed", err);
          // Fall through — inbox row is still saved as new.
        }
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

    let reportId = req.body?.report_id ? Number(req.body.report_id) : null;
    if (!reportId && row.sample_id && /^\d+$/.test(row.sample_id.trim())) {
      reportId = Number(row.sample_id.trim());
    }

    if (!reportId) {
      return res.status(400).json({
        error: "report_id required (or set sample id on the machine to the report number)",
      });
    }

    const report = await Report.findByPk(reportId, {
      include: [{ model: ReportItem, as: "reportItems" }],
    });
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
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

    return res.json({ success: true, applied, report_id: report.id });
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

    const created = await createCbcReportFromInbox(
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
