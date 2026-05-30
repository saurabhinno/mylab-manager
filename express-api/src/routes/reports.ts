import { Router, Request, Response } from "express";
import { Report } from "@/models/Report";
import { ReportItem } from "@/models/ReportItem";
import { TestDefinition } from "@/models/TestDefinition";
import { User } from "@/models/User";
import { LabSettings } from "@/models/LabSettings";

const router = Router();

// List all reports
router.get("/", async (req: Request, res: Response) => {
  try {
    const reports = await Report.findAll({
      include: [
        { model: ReportItem, as: "reportItems" },
        { model: User, as: "compounder", attributes: ["id", "name", "email"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json(reports);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get single report with full details for viewing/printing
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const report = await Report.findByPk(req.params.id, {
      include: [{ model: ReportItem, as: "reportItems" }],
    });
    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }

    const doctor = await User.findByPk(report.doctor_id, {
      attributes: ["id", "name", "email", "signature_image"],
    });

    const labSettings = await LabSettings.findOne();

    return res.json({ ...report.toJSON(), doctor, labSettings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 1: Collect sample — create report as draft
router.post("/", async (req: Request, res: Response) => {
  try {
    const { patientName, age, weight, gender, phone, referredBy, tests, paymentStatus } = req.body;

    if (!patientName?.trim()) {
      return res.status(400).json({ error: "Patient name is required." });
    }
    if (!tests?.length) {
      return res.status(400).json({ error: "At least one test is required." });
    }

    const testIds = tests.map((t: any) => t.testId || t);
    const testDefinitions = await TestDefinition.findAll({
      where: { id: testIds },
      include: [{ model: TestDefinition, as: "parameters", order: [["display_order", "ASC"]] }],
    });
    const totalPrice = testDefinitions.reduce((sum, test) => sum + test.price, 0);

    const doctor = await User.findOne({ where: { role: "doctor" } });
    if (!doctor) {
      return res.status(500).json({ error: "No doctor account configured." });
    }

    const report = await Report.create({
      patient_name: patientName.trim(),
      patient_age: age || 0,
      patient_weight: weight || 0,
      patient_gender: gender || null,
      patient_phone: phone || null,
      referred_by: referredBy || null,
      total_price: totalPrice,
      payment_status: paymentStatus || "unpaid",
      status: "sample_collected",
      sample_collected_at: new Date(),
      compounder_id: 1,
      doctor_id: doctor.id,
    });

    // Create report items: for panels, create items for each child parameter
    for (const def of testDefinitions) {
      const params = (def as any).parameters || [];
      if (def.is_panel && params.length > 0) {
        // Panel test: create report items for each parameter
        for (const param of params) {
          await ReportItem.create({
            report_id: report.id,
            test_definition_id: param.id,
            test_name: param.name,
            sample_type: param.sample_type || def.sample_type || null,
            result_type: "numeric",
            result_value: "",
            unit: param.unit || null,
            normal_min: param.default_min,
            normal_max: param.default_max,
            note: null,
            price: 0,
            panel_name: def.name,
          });
        }
      } else {
        // Standalone test: create single report item
        await ReportItem.create({
          report_id: report.id,
          test_definition_id: def.id,
          test_name: def.name,
          sample_type: def.sample_type || null,
          result_type: "numeric",
          result_value: "",
          unit: def.unit || null,
          normal_min: def.default_min,
          normal_max: def.default_max,
          note: null,
          price: def.price,
          panel_name: null,
        });
      }
    }

    return res.json({ success: true, reportId: report.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 2: Enter results — update report items with values
router.put("/:id/results", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { results } = req.body; // [{ itemId, result_value, result_type?, note? }]

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }

    if (results && Array.isArray(results)) {
      for (const r of results) {
        const item = await ReportItem.findByPk(r.itemId);
        if (item && item.report_id === report.id) {
          item.result_value = r.result_value ?? item.result_value;
          if (r.result_type) item.result_type = r.result_type;
          if (r.note !== undefined) item.note = r.note;
          await item.save();
        }
      }
    }

    // Update status
    report.status = "results_entered";
    await report.save();

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Finalize report
router.put("/:id/finalize", async (req: Request, res: Response) => {
  try {
    const report = await Report.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }
    report.status = "finalized";
    await report.save();
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update payment status
router.put("/:id/payment", async (req: Request, res: Response) => {
  try {
    const report = await Report.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }
    report.payment_status = req.body.payment_status || "paid";
    await report.save();
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
