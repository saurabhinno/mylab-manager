import { Router, Request, Response } from "express";
import { TestDefinition } from "@/models/TestDefinition";
import { requireDoctor } from "@/lib/auth";

const router = Router();

// Get all tests with their parameters (for panels)
router.get("/", async (req: Request, res: Response) => {
  try {
    const tests = await TestDefinition.findAll({
      where: { parent_id: null },
      include: [{ model: TestDefinition, as: "parameters", order: [["display_order", "ASC"]] }],
      order: [["category", "ASC"], ["name", "ASC"]],
    });
    return res.json(tests);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get all tests flat (for internal use)
router.get("/flat", async (req: Request, res: Response) => {
  try {
    const tests = await TestDefinition.findAll({ order: [["category", "ASC"], ["name", "ASC"]] });
    return res.json(tests);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new test (standalone or panel) — doctor only
router.post("/", requireDoctor, async (req: Request, res: Response) => {
  try {
    const { name, category, sample_type, method, defaultMin, defaultMax, unit, price, report_time, is_panel, parameters } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Test name is required." });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: "Category is required." });
    }
    if (!sample_type || !sample_type.trim()) {
      return res.status(400).json({ error: "Sample type is required." });
    }
    if (price == null || price < 0) {
      return res.status(400).json({ error: "Valid price is required." });
    }

    const existing = await TestDefinition.findOne({ where: { name: name.trim(), parent_id: null } });
    if (existing) {
      return res.status(400).json({ error: "A test with this name already exists." });
    }

    const test = await TestDefinition.create({
      name: name.trim(),
      category: category.trim(),
      sample_type: sample_type.trim(),
      method: method?.trim() || null,
      default_min: is_panel ? null : (defaultMin ?? null),
      default_max: is_panel ? null : (defaultMax ?? null),
      unit: is_panel ? null : (unit?.trim() || null),
      price,
      report_time: report_time?.trim() || null,
      is_panel: !!is_panel,
      parent_id: null,
      display_order: 0,
    });

    // If it's a panel, create child parameters
    if (is_panel && parameters && Array.isArray(parameters)) {
      for (let i = 0; i < parameters.length; i++) {
        const p = parameters[i];
        if (p.name?.trim()) {
          await TestDefinition.create({
            name: p.name.trim(),
            category: category.trim(),
            sample_type: sample_type.trim(),
            method: p.method?.trim() || method?.trim() || null,
            default_min: p.defaultMin ?? null,
            default_max: p.defaultMax ?? null,
            unit: p.unit?.trim() || null,
            price: 0,
            report_time: report_time?.trim() || null,
            is_panel: false,
            parent_id: test.id,
            display_order: i + 1,
          });
        }
      }
    }

    // Return with parameters
    const result = await TestDefinition.findByPk(test.id, {
      include: [{ model: TestDefinition, as: "parameters" }],
    });

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update a test — doctor only
// Upsert parameters in place so report_items FKs are not broken.
router.put("/:id", requireDoctor, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, sample_type, method, defaultMin, defaultMax, unit, price, report_time, is_panel, parameters } = req.body;

    const test = await TestDefinition.findByPk(id);
    if (!test) {
      return res.status(404).json({ error: "Test not found." });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Test name is required." });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: "Category is required." });
    }
    if (!sample_type || !sample_type.trim()) {
      return res.status(400).json({ error: "Sample type is required." });
    }
    if (price == null || Number(price) < 0) {
      return res.status(400).json({ error: "Valid price is required." });
    }

    // Check duplicate name (excluding self)
    const existing = await TestDefinition.findOne({ where: { name: name.trim(), parent_id: null } });
    if (existing && existing.id !== test.id) {
      return res.status(400).json({ error: "A test with this name already exists." });
    }

    test.name = name.trim();
    test.category = category.trim();
    test.sample_type = sample_type.trim();
    test.method = method?.trim() || null;
    test.default_min = is_panel ? null : (defaultMin ?? null);
    test.default_max = is_panel ? null : (defaultMax ?? null);
    test.unit = is_panel ? null : (unit?.trim() || null);
    test.price = Number(price);
    test.report_time = report_time?.trim() || null;
    test.is_panel = !!is_panel;
    await test.save();

    if (is_panel && parameters && Array.isArray(parameters)) {
      const existingParams = await TestDefinition.findAll({
        where: { parent_id: test.id },
      });
      const keepIds = new Set<number>();

      for (let i = 0; i < parameters.length; i++) {
        const p = parameters[i];
        if (!p?.name?.trim()) continue;

        const fields = {
          name: String(p.name).trim(),
          category: category.trim(),
          sample_type: sample_type.trim(),
          method: p.method?.trim() || method?.trim() || null,
          default_min: p.defaultMin ?? p.default_min ?? null,
          default_max: p.defaultMax ?? p.default_max ?? null,
          unit: p.unit?.trim?.() ? p.unit.trim() : p.unit || null,
          price: 0,
          report_time: report_time?.trim() || null,
          is_panel: false,
          parent_id: test.id,
          display_order: i + 1,
        };

        const paramId = p.id != null ? Number(p.id) : null;
        const row =
          paramId && existingParams.find((e) => e.id === paramId)
            ? existingParams.find((e) => e.id === paramId)!
            : null;

        if (row) {
          Object.assign(row, fields);
          await row.save();
          keepIds.add(row.id);
        } else {
          const created = await TestDefinition.create(fields);
          keepIds.add(created.id);
        }
      }

      for (const old of existingParams) {
        if (keepIds.has(old.id)) continue;
        try {
          await old.destroy();
        } catch (err) {
          // Still referenced by report_items — detach from panel instead of failing
          console.warn(
            `Could not delete parameter #${old.id}; detaching from panel`,
            err
          );
          old.parent_id = null;
          await old.save();
        }
      }
    } else if (!is_panel) {
      const children = await TestDefinition.findAll({
        where: { parent_id: test.id },
      });
      for (const child of children) {
        try {
          await child.destroy();
        } catch {
          child.parent_id = null;
          await child.save();
        }
      }
    }

    const result = await TestDefinition.findByPk(test.id, {
      include: [
        {
          model: TestDefinition,
          as: "parameters",
          separate: true,
          order: [["display_order", "ASC"]],
        },
      ],
    });

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a test — doctor only
router.delete("/:id", requireDoctor, async (req: Request, res: Response) => {
  try {
    const test = await TestDefinition.findByPk(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found." });
    }
    const children = await TestDefinition.findAll({
      where: { parent_id: test.id },
    });
    for (const child of children) {
      try {
        await child.destroy();
      } catch {
        child.parent_id = null;
        await child.save();
      }
    }
    try {
      await test.destroy();
    } catch (err) {
      console.error(err);
      return res.status(400).json({
        error: "Cannot delete this test because it is used in existing reports.",
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
