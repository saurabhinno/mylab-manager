import { Router, Request, Response } from "express";
import { TestDefinition } from "@/models/TestDefinition";

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

// Create a new test (standalone or panel)
router.post("/", async (req: Request, res: Response) => {
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

// Update a test
router.put("/:id", async (req: Request, res: Response) => {
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
    if (price == null || price < 0) {
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
    test.price = price;
    test.report_time = report_time?.trim() || null;
    test.is_panel = !!is_panel;
    await test.save();

    // If panel, update parameters
    if (is_panel && parameters && Array.isArray(parameters)) {
      // Delete old parameters
      await TestDefinition.destroy({ where: { parent_id: test.id } });

      // Create new parameters
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
    } else if (!is_panel) {
      // If changed from panel to standalone, remove children
      await TestDefinition.destroy({ where: { parent_id: test.id } });
    }

    const result = await TestDefinition.findByPk(test.id, {
      include: [{ model: TestDefinition, as: "parameters" }],
    });

    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a test
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const test = await TestDefinition.findByPk(req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Test not found." });
    }
    // Delete children if panel
    await TestDefinition.destroy({ where: { parent_id: test.id } });
    await test.destroy();
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
