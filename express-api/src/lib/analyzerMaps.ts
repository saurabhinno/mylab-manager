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

/** Shared CBC code map used by 3-part counters (Cellenium / Mindray-style codes). */
const CBC_3PART_CODES: Record<string, string> = {
  WBC: "Total WBC Count",
  RBC: "RBC Count",
  HGB: "Hemoglobin (Hb)",
  HB: "Hemoglobin (Hb)",
  HCT: "PCV / Hematocrit",
  PCV: "PCV / Hematocrit",
  MCV: "MCV",
  MCH: "MCH",
  MCHC: "MCHC",
  RDW: "RDW-CV",
  "RDW-CV": "RDW-CV",
  RDWCV: "RDW-CV",
  "RDW-SD": "RDW-SD",
  RDWSD: "RDW-SD",
  PLT: "Platelet Count",
  PLATELET: "Platelet Count",
  MPV: "MPV",
  PDW: "PDW",
  "PDW-CV": "PDW",
  "PDW-SD": "PDW",
  PDWCV: "PDW",
  PDWSD: "PDW",
  PCT: "PCT",
  "LYM%": "Lymphocytes",
  "LYMPH%": "Lymphocytes",
  "LY%": "Lymphocytes",
  LYM: "Lymphocytes",
  "MID%": "Monocytes",
  "MXD%": "Monocytes",
  "MON%": "Monocytes",
  MID: "Monocytes",
  "GRAN%": "Neutrophils",
  "GR%": "Neutrophils",
  "NEUT%": "Neutrophils",
  "NEU%": "Neutrophils",
  GRAN: "Neutrophils",
  "LYM#": "Absolute Lymphocyte Count",
  "LYMPH#": "Absolute Lymphocyte Count",
  "LY#": "Absolute Lymphocyte Count",
  "MID#": "Absolute Monocyte Count",
  "MXD#": "Absolute Monocyte Count",
  "GRAN#": "Absolute Neutrophil Count",
  "GR#": "Absolute Neutrophil Count",
  "NEUT#": "Absolute Neutrophil Count",
  "NEU#": "Absolute Neutrophil Count",
  "EOS%": "Eosinophils",
  "EO%": "Eosinophils",
  "BAS%": "Basophils",
  "BA%": "Basophils",
};

export const ANALYZER_PROFILES: AnalyzerProfile[] = [
  {
    id: "cellenium-21",
    label: "Cellenium 21",
    defaultBaud: 9600,
    protocolHint:
      "Cellenium 21 LAN: Start LAN listen (port 5100). On machine Trans=Net, Server IP=this PC, Port=5100, Protocol=HL7. Direct cable needs USB‑C Ethernet on Mac + static IPs (PC 192.168.10.1 / machine 192.168.10.2).",
    codes: {
      ...CBC_3PART_CODES,
      // Brochure parameter names as sometimes emitted
      "P-LCR": "PCT",
      "P-LCC": "Platelet Count",
      PLCR: "PCT",
      PLCC: "Platelet Count",
    },
  },
  {
    id: "generic-astm",
    label: "Generic ASTM CBC",
    defaultBaud: 9600,
    protocolHint: "Generic ASTM E1394 / CLSI LIS02 over serial.",
    codes: CBC_3PART_CODES,
  },
];

export function getProfile(id?: string | null): AnalyzerProfile {
  return (
    ANALYZER_PROFILES.find((p) => p.id === id) ||
    ANALYZER_PROFILES.find((p) => p.id === "cellenium-21") ||
    ANALYZER_PROFILES[0]
  );
}
