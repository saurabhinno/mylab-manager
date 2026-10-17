/**
 * Minimal HL7 v2 ORU parser for analyzer result messages (OBX segments).
 * Also unwraps MLLP framing if present.
 */

import type { AstmMessage, AstmResult } from "@/lib/astm";

const VT = "\x0b";
const FS = "\x1c";

export function unwrapMllp(raw: string): string {
  let s = raw;
  const start = s.indexOf(VT);
  if (start >= 0) s = s.slice(start + 1);
  const end = s.indexOf(FS);
  if (end >= 0) s = s.slice(0, end);
  return s;
}

export function looksLikeHl7(raw: string): boolean {
  const s = unwrapMllp(raw);
  return /(?:^|\r|\n)MSH\|/.test(s) && /(?:^|\r|\n)OBX\|/.test(s);
}

function fields(seg: string, sep = "|"): string[] {
  return seg.split(sep);
}

/** OBX-3 often CODE^text^system — prefer code. */
function extractObxCode(field: string | undefined): string {
  if (!field) return "";
  const parts = field.split("^").filter(Boolean);
  return (parts[0] || field).trim();
}

export function parseHl7(raw: string): AstmMessage {
  const body = unwrapMllp(raw);
  const lines = body
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean);

  let sampleId: string | null = null;
  let patientName: string | null = null;
  const results: AstmResult[] = [];

  for (const line of lines) {
    const type = line.slice(0, 3);
    const f = fields(line);

    if (type === "PID") {
      // PID-5 = name
      const nameField = f[5] || "";
      if (nameField) {
        patientName =
          nameField
            .split("^")
            .filter(Boolean)
            .join(" ")
            .trim() || null;
      }
      if (f[3] && !sampleId) sampleId = f[3].split("^")[0].trim() || null;
    } else if (type === "OBR") {
      // OBR-3 filler order / OBR-2 placer
      if (f[3]) sampleId = f[3].split("^")[0].trim() || sampleId;
      if (f[2] && !sampleId) sampleId = f[2].split("^")[0].trim() || sampleId;
    } else if (type === "OBX") {
      const code = extractObxCode(f[3]);
      const valueType = (f[2] || "").toUpperCase();
      // OBX-5 value; for NM/ST usually plain
      let value = (f[5] || "").trim();
      if (value.includes("^")) value = value.split("^")[0].trim();
      const unit = (f[6] || "").split("^")[0].trim() || null;
      const flags = (f[8] || "").trim() || null;
      if (code && value !== "" && valueType !== "ED") {
        results.push({ code, value, unit, flags, raw: line });
      }
    }
  }

  return {
    sampleId,
    patientName,
    results,
    recordCount: lines.length,
    raw,
  };
}
