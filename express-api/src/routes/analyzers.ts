import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { requireAuth } from "@/lib/auth";
import { parseAstm, looksLikeAstm, normalizeInstrumentPayload } from "@/lib/astm";
import { parseHl7, looksLikeHl7 } from "@/lib/hl7";
import { ANALYZER_PROFILES, getProfile } from "@/lib/analyzerMaps";
import { AnalyzerInbox } from "@/models/AnalyzerInbox";
import { Report } from "@/models/Report";
import { ReportItem } from "@/models/ReportItem";

const router = Router();

function loadCodeMap(profileId: string): Record<string, string> {
  return getProfile(profileId).codes;
}

function normalizeKey(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}

function mapResults(
  results: { code: string; value: string; unit: string | null }[],
  codeMap: Record<string, string>
) {
  const mapped: { code: string; testName: string | null; value: string; unit: string | null }[] =
    [];
  for (const r of results) {
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
    const items = (report as any).reportItems as ReportItem[];
    let applied = 0;

    for (const m of mapped) {
      if (!m.testName || m.value === "") continue;
      const target = items.find(
        (it) =>
          it.test_name.trim().toLowerCase() === m.testName!.trim().toLowerCase()
      );
      if (target) {
        target.result_value = String(m.value);
        target.result_type = "numeric";
        await target.save();
        applied++;
      }
    }

    report.status = "results_entered";
    await report.save();

    row.status = "applied";
    row.applied_report_id = report.id;
    await row.save();

    return res.json({ success: true, applied, report_id: report.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Apply failed" });
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
