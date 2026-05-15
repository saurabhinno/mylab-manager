import { Router, Request, Response } from "express";
import { TestDefinition } from "@/models/TestDefinition";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const tests = await TestDefinition.findAll({ order: [["category", "ASC"], ["name", "ASC"]] });
    return res.json(tests);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, category, sample_type, method, defaultMin, defaultMax, unit, price, report_time } = req.body;

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

    const existing = await TestDefinition.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({ error: "A test with this name already exists." });
    }

    const test = await TestDefinition.create({
      name: name.trim(),
      category: category.trim(),
      sample_type: sample_type.trim(),
      method: method?.trim() || null,
      default_min: defaultMin ?? null,
      default_max: defaultMax ?? null,
      unit: unit?.trim() || null,
      price,
      report_time: report_time?.trim() || null,
    });

    return res.json(test);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, sample_type, method, defaultMin, defaultMax, unit, price, report_time } = req.body;

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
    const existing = await TestDefinition.findOne({ where: { name: name.trim() } });
    if (existing && existing.id !== test.id) {
      return res.status(400).json({ error: "A test with this name already exists." });
    }

    test.name = name.trim();
    test.category = category.trim();
    test.sample_type = sample_type.trim();
    test.method = method?.trim() || null;
    test.default_min = defaultMin ?? null;
    test.default_max = defaultMax ?? null;
    test.unit = unit?.trim() || null;
    test.price = price;
    test.report_time = report_time?.trim() || null;
    await test.save();

    return res.json(test);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
