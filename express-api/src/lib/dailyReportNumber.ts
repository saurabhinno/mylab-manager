import { Op } from "sequelize";
import { Report } from "@/models/Report";

/** Local calendar date as YYYY-MM-DD (matches DATEONLY). */
export function todayDateOnly(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Next report number for a given day (starts at 1 each day). */
export async function nextDailyNumber(dateStr: string): Promise<number> {
  const max = await Report.max("daily_number", {
    where: { date: dateStr },
  });
  const n = typeof max === "number" && Number.isFinite(max) ? max : 0;
  return n + 1;
}

export async function allocateTodayReportNumber(d = new Date()) {
  const date = todayDateOnly(d);
  const daily_number = await nextDailyNumber(date);
  return { date, daily_number };
}

/**
 * Resolve a machine sample id to a report.
 * Prefer today's daily_number, then primary key, then latest matching daily_number.
 */
export async function findReportBySampleOrId(
  sampleOrId: number,
  includeItems = false
) {
  const { ReportItem } = await import("@/models/ReportItem");
  const include = includeItems
    ? [{ model: ReportItem, as: "reportItems" }]
    : undefined;
  const today = todayDateOnly();

  let report = await Report.findOne({
    where: { date: today, daily_number: sampleOrId },
    include,
  });
  if (report) return report;

  report = await Report.findByPk(sampleOrId, { include });
  if (report) return report;

  return Report.findOne({
    where: { daily_number: sampleOrId },
    order: [
      ["date", "DESC"],
      ["id", "DESC"],
    ],
    include,
  });
}

/** Backfill daily_number for existing rows (per date, ordered by id). */
export async function backfillDailyNumbers() {
  const missing = await Report.count({
    where: {
      [Op.or]: [{ daily_number: null }, { daily_number: 0 }],
    },
  });
  if (!missing) return;

  const dates = (await Report.findAll({
    attributes: ["date"],
    group: ["date"],
    order: [["date", "ASC"]],
    raw: true,
  })) as unknown as { date: string }[];

  for (const row of dates) {
    const date = String(row.date).slice(0, 10);
    const reports = await Report.findAll({
      where: { date },
      order: [["id", "ASC"]],
    });
    let n = 0;
    for (const r of reports) {
      n += 1;
      if (r.daily_number !== n) {
        r.daily_number = n;
        await r.save();
      }
    }
  }
  console.log(`Backfilled daily_number for reports across ${dates.length} day(s)`);
}
