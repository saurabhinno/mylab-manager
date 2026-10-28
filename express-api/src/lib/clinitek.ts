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
  /** Calendar date of the strip, YYYY-MM-DD, when the analyzer sent one. */
  testedAt: string | null;
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
    testedAt: null,
    results,
  };
}

function cleanAstmText(value: string): string {
  return value.replace(/&X[0-9A-Fa-f]+&/g, "").replace(/\s+/g, " ").trim();
}

/** Siemens packs the conventional result as &Xhhhh& (e.g. 312B → 1+). */
function decodeSiemensHex(value: string): string {
  const match = /&X([0-9A-Fa-f]+)&/.exec(value || "");
  if (!match || match[1].length % 2 !== 0) return "";
  let text = "";
  for (let i = 0; i < match[1].length; i += 2) {
    text += String.fromCharCode(parseInt(match[1].slice(i, i + 2), 16));
  }
  return text.replace(/\s+/g, " ").trim();
}

function stampToDate(stamp: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(stamp.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Clinitek Status+ ASTM. One patient is M|…|p^…, then M|…|a^… analyte rows.
 * Example analyte: M|2|a^73|GLU|Negative|||GLU|
 */
export function parseClinitekAstm(raw: string): ClinitekParse {
  const lines = String(raw || "")
    .replace(/\u0000/g, "")
    .split(/\r\n|\n|\r/)
    .map((line) => line.replace(/[\x02\x03\x04\x17]/g, "").replace(/^\d(?=[HMPOLR]\|)/, "").trim())
    .filter(Boolean);

  let sampleId: string | null = null;
  let patientName: string | null = null;
  let testedAt: string | null = null;
  const results: ClinitekParse["results"] = [];

  for (const line of lines) {
    if (!line.startsWith("M|")) continue;
    const fields = line.split("|");
    const kind = (fields[2] || "").split("^")[0].trim().toLowerCase();
    if (kind === "p") {
      const stamp = (fields[3] || "").trim();
      const seq = (fields[2] || "").split("^")[1] || "";
      testedAt = stampToDate(stamp);
      sampleId = stamp && seq ? `${stamp}:${seq}` : seq || stamp || null;
      const nameParts = (fields[4] || "").split("^").map((p) => p.trim()).filter(Boolean);
      const name = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0] || "";
      patientName = name || null;
      const demo = (fields[5] || "").split("^").map(cleanAstmText);
      const color = demo[1] || "";
      const clarity = demo[2] || "";
      if (color) results.push({ code: "COL", value: color, unit: null });
      if (clarity) results.push({ code: "CLA", value: clarity, unit: null });
    } else if (kind === "a") {
      const code = codeKey(fields[3] || "");
      let value = (fields[4] || "").trim();
      const unit = (fields[5] || "").trim();
      // Bilirubin’s word (Small / Moderate) is the description. The packed
      // field is the result the strip actually graded (1+, 2+, 3+).
      if (code === "BIL") {
        const exact = decodeSiemensHex(fields[8] || "");
        if (exact) value = exact;
      }
      if (!code || !value) continue;
      const display = unit ? `${value} ${unit}` : value;
      results.push({ code, value: display, unit: unit || null });
    }
  }

  return { sampleId, patientName, testedAt, results };
}
