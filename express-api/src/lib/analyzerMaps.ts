/** Built-in analyzer code → MyLab test_name maps. */

export type AnalyzerProfile = {
  id: string;
  label: string;
  /** Hint for serial open; operator can still change baud in UI. */
  defaultBaud: number;
  /** How this model usually talks to a PC. */
  protocolHint: string;
  codes: Record<string, string>;
};

/**
 * Cellenium / Mindray-style codes → current CBC catalogue names.
 * Panel: "Complete Blood Count(CBC)" (and older "Complete Blood Count (CBC)").
 */
const CBC_3PART_CODES: Record<string, string> = {
  WBC: "WBC",
  RBC: "RBC",
  HGB: "HEMOGLOBIN",
  HB: "HEMOGLOBIN",
  HCT: "HCT",
  PCV: "HCT",
  MCV: "MCV",
  MCH: "MCH",
  MCHC: "MCHC",
  RDW: "RDW-CV",
  "RDW-CV": "RDW-CV",
  RDW_CV: "RDW-CV",
  RDWCV: "RDW-CV",
  "RDW-SD": "RDW-SD",
  RDW_SD: "RDW-SD",
  RDWSD: "RDW-SD",
  PLT: "PLATELET COUNT (PLT)",
  PLATELET: "PLATELET COUNT (PLT)",
  MPV: "MPV",
  PDW: "PDW",
  "PDW-CV": "PDW",
  PDW_CV: "PDW",
  "PDW-SD": "PDW",
  PDW_SD: "PDW",
  PDWCV: "PDW",
  PDWSD: "PDW",
  PCT: "PCT",
  "LYM%": "LYMPHOCYTES",
  "LYMPH%": "LYMPHOCYTES",
  "LY%": "LYMPHOCYTES",
  LYM: "LYMPHOCYTES",
  // MID%/MXD% are expanded by expandMidCellResults (not mapped 1:1)
  "MON%": "MONOCYTES",
  "GRAN%": "NEUTROPHILS",
  "GR%": "NEUTROPHILS",
  "NEUT%": "NEUTROPHILS",
  "NEU%": "NEUTROPHILS",
  GRAN: "NEUTROPHILS",
  // Absolute counts — only applied if the panel has matching params
  "LYM#": "Absolute Lymphocyte Count",
  "LYMPH#": "Absolute Lymphocyte Count",
  "LY#": "Absolute Lymphocyte Count",
  "GRAN#": "Absolute Neutrophil Count",
  "GR#": "Absolute Neutrophil Count",
  "NEUT#": "Absolute Neutrophil Count",
  "NEU#": "Absolute Neutrophil Count",
  "EOS%": "EOSINOPHIL",
  "EO%": "EOSINOPHIL",
  "BAS%": "BASOPHILS",
  "BA%": "BASOPHILS",
};

/**
 * 3-part MID/MXD = mono + eos + bas (not measured separately).
 * Lab split (derived): Eosinophil 70%, Monocyte 25%, Basophil 5%.
 */
export const MID_CELL_SPLIT = {
  eosinophil: 0.7,
  monocyte: 0.25,
  basophil: 0.05,
} as const;

const MID_PERCENT_CODES = new Set(["MID%", "MXD%", "MID"]);
const MID_ABS_CODES = new Set(["MID#", "MXD#"]);

function normalizeAnalyzerCode(code: string) {
  return code.trim().toUpperCase().replace(/[\s_]/g, "");
}

function formatSplitValue(n: number, absolute: boolean): string {
  if (absolute) return String(Math.round(n));
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export type MappedAnalyzerResult = {
  code: string;
  testName: string | null;
  value: string;
  unit: string | null;
  /** True when value came from MID/MXD ratio split (not measured). */
  derivedFromMid?: boolean;
};

/**
 * Expand MID%/MXD% (and MID#/MXD#) into Eosinophil / Monocyte / Basophil
 * using MID_CELL_SPLIT. Other rows pass through unchanged.
 */
export function expandMidCellResults(
  mapped: MappedAnalyzerResult[]
): MappedAnalyzerResult[] {
  const out: MappedAnalyzerResult[] = [];
  for (const m of mapped) {
    const key = normalizeAnalyzerCode(m.code);
    const isPct = [...MID_PERCENT_CODES].some(
      (c) => normalizeAnalyzerCode(c) === key
    );
    const isAbs = [...MID_ABS_CODES].some(
      (c) => normalizeAnalyzerCode(c) === key
    );
    if (!isPct && !isAbs) {
      out.push(m);
      continue;
    }
    const n = parseFloat(String(m.value).replace(/,/g, ""));
    if (!Number.isFinite(n)) {
      out.push(m);
      continue;
    }
    out.push({
      code: m.code,
      testName: "EOSINOPHIL",
      value: formatSplitValue(n * MID_CELL_SPLIT.eosinophil, isAbs),
      unit: m.unit,
      derivedFromMid: true,
    });
    out.push({
      code: m.code,
      testName: "MONOCYTES",
      value: formatSplitValue(n * MID_CELL_SPLIT.monocyte, isAbs),
      unit: m.unit,
      derivedFromMid: true,
    });
    out.push({
      code: m.code,
      testName: "BASOPHILS",
      value: formatSplitValue(n * MID_CELL_SPLIT.basophil, isAbs),
      unit: m.unit,
      derivedFromMid: true,
    });
  }
  return out;
}

/** Alias groups so machine names match either old or new catalogue labels. */
const NAME_ALIASES: string[][] = [
  ["wbc", "totalwbccount", "totalwbc"],
  ["rbc", "rbccount"],
  ["hemoglobin", "hemoglobinhb", "hb", "hgb"],
  ["hct", "pcv", "pcvhematocrit", "hematocrit"],
  ["mcv"],
  ["mch"],
  ["mchc"],
  ["rdwcv", "rdw"],
  ["rdwsd"],
  ["plateletcountplt", "plateletcount", "plt", "platelet"],
  ["lymphocyte", "lymphocytes", "lym"],
  ["monosyte", "monocyte", "monocytes"],
  ["neutrophil", "neutrophils", "gran", "neu", "neut"],
  ["eosinophil", "eosinophils", "eos"],
  ["basophil", "basophils", "bas"],
  ["mpv"],
  ["pdw"],
  ["pct"],
  ["absoluteneutrophilcount", "anc"],
  ["absolutelymphocytecount", "alc"],
  ["absolutemonocytecount"],
];

export function normalizeTestName(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Find the best matching catalogue / report-item name for a mapped test. */
export function matchCatalogueName(
  candidates: string[],
  target: string
): string | null {
  if (!target || !candidates.length) return null;
  const t = normalizeTestName(target);
  for (const c of candidates) {
    if (normalizeTestName(c) === t) return c;
  }
  for (const group of NAME_ALIASES) {
    const targetInGroup = group.some(
      (a) => a === t || t.includes(a) || a.includes(t)
    );
    if (!targetInGroup) continue;
    for (const c of candidates) {
      const n = normalizeTestName(c);
      if (group.some((a) => n === a || n.includes(a) || a.includes(n))) {
        return c;
      }
    }
  }
  for (const c of candidates) {
    const n = normalizeTestName(c);
    if (n.includes(t) || t.includes(n)) return c;
  }
  return null;
}

export const ANALYZER_PROFILES: AnalyzerProfile[] = [
  {
    id: "cellenium-21",
    label: "Cellenium 21",
    defaultBaud: 9600,
    protocolHint:
      "Cellenium 21 LAN: Start LAN listen (port 5100). On machine Trans=Net, Server IP=this PC, Port=5100, Protocol=HL7. Direct cable needs USB‑C Ethernet on Mac + static IPs (PC 192.168.10.1 / machine 192.168.10.2).",
    codes: {
      ...CBC_3PART_CODES,
      // P-LCR / P-LCC are platelet large-cell indices — leave unmapped.
    },
  },
  {
    id: "generic-astm",
    label: "Generic ASTM CBC",
    defaultBaud: 9600,
    protocolHint: "Generic ASTM E1394 / CLSI LIS02 over serial.",
    codes: CBC_3PART_CODES,
  },
  {
    id: "clinitek-status",
    label: "Clinitek Status+",
    defaultBaud: 9600,
    protocolHint:
      "USB serial (FTDI, often COM6). Analyzer Connectivity: Computer, 9600 baud, 8 data bits, no parity, 1 stop. Run a urine strip — MyLab creates a Urine Routine report.",
    codes: {
      GLU: "Glucose",
      BIL: "Bilirubin",
      KET: "Ketones",
      SG: "Specific Gravity",
      BLO: "Blood",
      pH: "pH",
      PRO: "Protein",
      URO: "Urobilinogen",
      NIT: "Nitrite",
      LEU: "Leukocytes",
      ALB: "ALB",
      CRE: "Creat",
      "A:C": "A:C",
      "P:C": "A:C",
      COL: "Color",
      CLA: "Appearance",
    },
  },
];

export function getProfile(id?: string | null): AnalyzerProfile {
  return (
    ANALYZER_PROFILES.find((p) => p.id === id) ||
    ANALYZER_PROFILES.find((p) => p.id === "cellenium-21") ||
    ANALYZER_PROFILES[0]
  );
}

/**
 * Cellenium Net/HL7 typically emits counts as ×10³/µL (WBC 8.5, PLT 150).
 * Lab catalogue may use cells/µL (/cmm) or lakhs/µL for platelets.
 */
export function convertAnalyzerValueToLab(
  testName: string,
  rawValue: string,
  machineUnit?: string | null,
  labUnit?: string | null
): string {
  const name = normalizeTestName(testName);
  const n = parseFloat(String(rawValue).replace(/,/g, ""));
  if (!Number.isFinite(n)) return String(rawValue);

  const unit = (machineUnit || "").toLowerCase();
  const looksLikeX1000 =
    /x\s*10|10\^?3|10\s*\*\s*3|10e3|×\s*10/i.test(unit) || unit === "";

  // Platelets
  if (
    (name.includes("platelet") || name === "plt") &&
    looksLikeX1000 &&
    n >= 20 &&
    n < 5000
  ) {
    const lu = (labUnit || "").toLowerCase();
    if (/lakh/i.test(lu)) return (n / 100).toFixed(2);
    // /cmm, cells/µL (new CBC panel) → absolute count
    return String(Math.round(n * 1000));
  }

  // WBC (+ absolute counts if present)
  const isWbcFamily =
    name === "wbc" ||
    name === "totalwbccount" ||
    name.startsWith("absolute");
  if (isWbcFamily && looksLikeX1000 && n > 0 && n < 500) {
    return String(Math.round(n * 1000));
  }

  return String(rawValue);
}
