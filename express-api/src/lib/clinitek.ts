/**
 * Siemens Clinitek Status / Status+ unidirectional LIS record.
 * One CSV line ending in CR. Serial: 9600 8N1.
 * Fields 0–11 are header; then triples of abbreviation, result, positive-mark.
 */

const ANALYTE_CODES = new Set([
  "GLU",
  "BIL",
  "KET",
  "SG",
  "BLO",
  "PH",
  "PRO",
  "URO",
  "NIT",
  "LEU",
  "ALB",
  "CRE",
  "COL",
  "CLA",
  "A:C",
  "P:C",
]);

export type ClinitekParse = {
  sampleId: string | null;
  patientName: string | null;
  results: { code: string; value: string; unit: string | null }[];
};

export function looksLikeClinitek(raw: string): boolean {
  const text = String(raw || "").replace(/\u0000/g, "");
  if (!text.includes(",")) return false;
  if (/\bMSH\|/.test(text)) return false;
  return /(^|,)\s*(GLU|PRO|BIL|KET|LEU|NIT|URO|BLO|SG|pH)\s*,/i.test(text);
}

function isCode(field: string): boolean {
  const key = field.trim().toUpperCase();
  return ANALYTE_CODES.has(key === "PH" ? "PH" : key);
}

function codeKey(field: string): string {
  const key = field.trim().toUpperCase();
  return key === "PH" ? "pH" : key;
}

export function parseClinitek(raw: string): ClinitekParse {
  const line = String(raw || "")
    .replace(/\u0000/g, "")
    .split(/\r|\n/)
    .map((s) => s.trim())
    .find((s) => looksLikeClinitek(s)) || String(raw || "").trim();

  const fields = line.split(",").map((f) => f.trim());
  const results: { code: string; value: string; unit: string | null }[] = [];

  let i = fields.findIndex((f) => isCode(f));
  if (i < 0) {
    return { sampleId: null, patientName: null, results };
  }

  // Color and clarity sit immediately before the first reagent code.
  if (i >= 2) {
    const color = fields[i - 2];
    const clarity = fields[i - 1];
    if (color && !isCode(color) && !/^\d{4}/.test(color)) {
      results.push({ code: "COL", value: color, unit: null });
    }
    if (clarity && !isCode(clarity)) {
      results.push({ code: "CLA", value: clarity, unit: null });
    }
  }

  while (i < fields.length) {
    if (!isCode(fields[i])) break;
    const code = codeKey(fields[i]);
    const value = (fields[i + 1] || "").trim();
    if (value) results.push({ code, value, unit: null });
    i += 3; // abbreviation, clinical level, mark (* or blank)
  }

  const patientId = fields[4] || null;
  const patientName = fields[5] || null;
  return {
    sampleId: patientId && patientId.trim() ? patientId.trim() : null,
    patientName: patientName && patientName.trim() ? patientName.trim() : null,
    results,
  };
}
