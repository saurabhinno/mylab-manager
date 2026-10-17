/**
 * Minimal ASTM E1394 / CLSI LIS02 result parser for hematology analyzers.
 * Handles H/P/O/R/L records; ignores checksum frames (ENQ/ACK) if stripped.
 */

export type AstmResult = {
  code: string;
  value: string;
  unit: string | null;
  flags: string | null;
  raw: string;
};

export type AstmMessage = {
  sampleId: string | null;
  patientName: string | null;
  results: AstmResult[];
  recordCount: number;
  raw: string;
};

function stripFrame(line: string): string {
  // Drop STX/ETX/EOT and trailing checksums like "xx\x03"
  let s = line.replace(/[\x02\x03\x04\x05\x06\x15]/g, "").trim();
  // Record may start with frame number: "1H|\..." or "2R|..."
  s = s.replace(/^\d+/, "");
  return s;
}

function fields(record: string): string[] {
  return record.split("|");
}

/** Extract universal test ID from R.2 — often ^^^WBC or WBC^1 */
export function extractTestCode(field: string | undefined): string {
  if (!field) return "";
  const parts = field.split("^").filter(Boolean);
  // Prefer last non-empty component that looks like a code
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].trim();
    if (p && !/^\d+$/.test(p)) return p;
  }
  return parts[0]?.trim() || field.trim();
}

export function parseAstm(raw: string): AstmMessage {
  const lines = raw
    .split(/\r\n|\n|\r/)
    .map(stripFrame)
    .filter((l) => l.length > 0);

  let sampleId: string | null = null;
  let patientName: string | null = null;
  const results: AstmResult[] = [];

  for (const line of lines) {
    const type = line[0];
    const f = fields(line);

    if (type === "P") {
      // P|1|practice|lab|patientId|name^...
      const nameField = f[5] || f[4] || "";
      if (nameField) {
        patientName = nameField.split("^").filter(Boolean).join(" ").trim() || null;
      }
      if (f[3] && !sampleId) sampleId = f[3].trim() || null;
      if (f[2] && !sampleId) sampleId = f[2].trim() || null;
    } else if (type === "O") {
      // O|1|sampleId|...
      if (f[2]) sampleId = f[2].split("^")[0].trim() || sampleId;
      if (f[3] && !sampleId) sampleId = f[3].split("^")[0].trim() || sampleId;
    } else if (type === "R") {
      const code = extractTestCode(f[2]);
      const value = (f[3] || "").trim();
      const unit = (f[4] || "").trim() || null;
      const flags = (f[6] || f[5] || "").trim() || null;
      if (code && value !== "") {
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

/** True if buffer looks like ASTM (has H| and R| or O|). */
export function looksLikeAstm(raw: string): boolean {
  return /(?:^|\r|\n)\d*H\|/.test(raw) && /(?:^|\r|\n)\d*[OR]\|/.test(raw);
}

/** Strip MLLP / control chars that sometimes wrap ASTM-on-TCP. */
export function normalizeInstrumentPayload(raw: string): string {
  return raw
    .replace(/\x0b/g, "")
    .replace(/\x1c/g, "")
    .replace(/\x04/g, "");
}
