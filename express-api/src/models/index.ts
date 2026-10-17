import sequelize, { isSqlite } from "@/lib/sequelize";
import { User } from "@/models/User";
import { Patient } from "@/models/Patient";
import { TestDefinition } from "@/models/TestDefinition";
import { Report, associateReport } from "@/models/Report";
import { ReportItem } from "@/models/ReportItem";
import { LabSettings } from "@/models/LabSettings";
import { AnalyzerInbox } from "@/models/AnalyzerInbox";
import { hashPassword } from "@/lib/session";

type SeedParam = {
  name: string;
  unit: string | null;
  default_min: number | null;
  default_max: number | null;
  method: string | null;
  display_order: number;
};

type SeedPanel = {
  panel: {
    name: string;
    category: string;
    sample_type: string;
    method: string;
    price: number;
    report_time: string;
  };
  parameters: SeedParam[];
};

// Panel tests with their parameters (full common Indian lab catalogues)
const panelTests: SeedPanel[] = [
  {
    panel: { name: "Complete Blood Count (CBC)", category: "Hematology", sample_type: "Blood (EDTA)", method: "Automated Cell Counter", price: 350, report_time: "Same Day" },
    parameters: [
      { name: "Hemoglobin (Hb)", unit: "g/dL", default_min: 12, default_max: 17, method: "Cyanmethemoglobin", display_order: 1 },
      { name: "Total WBC Count", unit: "cells/µL", default_min: 4000, default_max: 11000, method: "Automated", display_order: 2 },
      { name: "RBC Count", unit: "million/µL", default_min: 4.5, default_max: 5.5, method: "Automated", display_order: 3 },
      { name: "PCV / Hematocrit", unit: "%", default_min: 36, default_max: 50, method: "Automated", display_order: 4 },
      { name: "MCV", unit: "fL", default_min: 80, default_max: 100, method: "Calculated", display_order: 5 },
      { name: "MCH", unit: "pg", default_min: 27, default_max: 32, method: "Calculated", display_order: 6 },
      { name: "MCHC", unit: "g/dL", default_min: 32, default_max: 36, method: "Calculated", display_order: 7 },
      { name: "RDW-CV", unit: "%", default_min: 11, default_max: 15, method: "Automated", display_order: 8 },
      { name: "RDW-SD", unit: "fL", default_min: 35, default_max: 56, method: "Automated", display_order: 9 },
      { name: "Platelet Count", unit: "lakhs/µL", default_min: 1.5, default_max: 4.0, method: "Automated", display_order: 10 },
      { name: "MPV", unit: "fL", default_min: 7.5, default_max: 11.5, method: "Automated", display_order: 11 },
      { name: "PDW", unit: "%", default_min: 9, default_max: 17, method: "Automated", display_order: 12 },
      { name: "PCT", unit: "%", default_min: 0.15, default_max: 0.40, method: "Automated", display_order: 13 },
      { name: "Neutrophils", unit: "%", default_min: 40, default_max: 70, method: "Differential", display_order: 14 },
      { name: "Lymphocytes", unit: "%", default_min: 20, default_max: 40, method: "Differential", display_order: 15 },
      { name: "Eosinophils", unit: "%", default_min: 1, default_max: 6, method: "Differential", display_order: 16 },
      { name: "Monocytes", unit: "%", default_min: 2, default_max: 10, method: "Differential", display_order: 17 },
      { name: "Basophils", unit: "%", default_min: 0, default_max: 1, method: "Differential", display_order: 18 },
      { name: "Absolute Neutrophil Count", unit: "cells/µL", default_min: 2000, default_max: 7000, method: "Calculated", display_order: 19 },
      { name: "Absolute Lymphocyte Count", unit: "cells/µL", default_min: 1000, default_max: 3000, method: "Calculated", display_order: 20 },
      { name: "Absolute Eosinophil Count", unit: "cells/µL", default_min: 40, default_max: 440, method: "Calculated", display_order: 21 },
      { name: "Absolute Monocyte Count", unit: "cells/µL", default_min: 200, default_max: 1000, method: "Calculated", display_order: 22 },
      { name: "Absolute Basophil Count", unit: "cells/µL", default_min: 0, default_max: 100, method: "Calculated", display_order: 23 },
    ],
  },
  {
    panel: { name: "Lipid Profile", category: "Biochemistry", sample_type: "Serum", method: "Enzymatic", price: 500, report_time: "Same Day" },
    parameters: [
      { name: "Total Cholesterol", unit: "mg/dL", default_min: 0, default_max: 200, method: "CHOD-PAP", display_order: 1 },
      { name: "Triglycerides", unit: "mg/dL", default_min: 0, default_max: 150, method: "GPO-PAP", display_order: 2 },
      { name: "HDL Cholesterol", unit: "mg/dL", default_min: 40, default_max: 60, method: "Direct", display_order: 3 },
      { name: "LDL Cholesterol", unit: "mg/dL", default_min: 0, default_max: 100, method: "Calculated", display_order: 4 },
      { name: "VLDL Cholesterol", unit: "mg/dL", default_min: 5, default_max: 40, method: "Calculated", display_order: 5 },
      { name: "Non-HDL Cholesterol", unit: "mg/dL", default_min: 0, default_max: 130, method: "Calculated", display_order: 6 },
      { name: "Total Cholesterol/HDL Ratio", unit: "", default_min: 0, default_max: 5, method: "Calculated", display_order: 7 },
      { name: "LDL/HDL Ratio", unit: "", default_min: 0, default_max: 3.5, method: "Calculated", display_order: 8 },
    ],
  },
  {
    panel: { name: "Liver Function Test (LFT)", category: "Biochemistry", sample_type: "Serum", method: "Multiple", price: 600, report_time: "Same Day" },
    parameters: [
      { name: "Total Bilirubin", unit: "mg/dL", default_min: 0.1, default_max: 1.2, method: "Diazo", display_order: 1 },
      { name: "Direct Bilirubin", unit: "mg/dL", default_min: 0, default_max: 0.3, method: "Diazo", display_order: 2 },
      { name: "Indirect Bilirubin", unit: "mg/dL", default_min: 0.1, default_max: 0.9, method: "Calculated", display_order: 3 },
      { name: "SGOT (AST)", unit: "U/L", default_min: 5, default_max: 40, method: "IFCC", display_order: 4 },
      { name: "SGPT (ALT)", unit: "U/L", default_min: 7, default_max: 56, method: "IFCC", display_order: 5 },
      { name: "Alkaline Phosphatase (ALP)", unit: "U/L", default_min: 44, default_max: 147, method: "IFCC", display_order: 6 },
      { name: "GGT (Gamma GT)", unit: "U/L", default_min: 0, default_max: 55, method: "IFCC", display_order: 7 },
      { name: "LDH", unit: "U/L", default_min: 140, default_max: 280, method: "IFCC", display_order: 8 },
      { name: "Total Protein", unit: "g/dL", default_min: 6.0, default_max: 8.3, method: "Biuret", display_order: 9 },
      { name: "Albumin", unit: "g/dL", default_min: 3.5, default_max: 5.5, method: "BCG", display_order: 10 },
      { name: "Globulin", unit: "g/dL", default_min: 2.0, default_max: 3.5, method: "Calculated", display_order: 11 },
      { name: "A/G Ratio", unit: "", default_min: 1.0, default_max: 2.5, method: "Calculated", display_order: 12 },
    ],
  },
  {
    panel: { name: "Kidney Function Test (KFT/RFT)", category: "Biochemistry", sample_type: "Serum", method: "Multiple", price: 600, report_time: "Same Day" },
    parameters: [
      { name: "Blood Urea", unit: "mg/dL", default_min: 15, default_max: 40, method: "Urease-GLDH", display_order: 1 },
      { name: "Serum Creatinine", unit: "mg/dL", default_min: 0.6, default_max: 1.2, method: "Jaffe's", display_order: 2 },
      { name: "Uric Acid", unit: "mg/dL", default_min: 3.5, default_max: 7.2, method: "Uricase", display_order: 3 },
      { name: "BUN (Blood Urea Nitrogen)", unit: "mg/dL", default_min: 7, default_max: 20, method: "Calculated", display_order: 4 },
      { name: "BUN/Creatinine Ratio", unit: "", default_min: 10, default_max: 20, method: "Calculated", display_order: 5 },
      { name: "eGFR", unit: "mL/min/1.73m²", default_min: 90, default_max: 120, method: "CKD-EPI", display_order: 6 },
      { name: "Sodium (Na+)", unit: "mEq/L", default_min: 136, default_max: 145, method: "ISE", display_order: 7 },
      { name: "Potassium (K+)", unit: "mEq/L", default_min: 3.5, default_max: 5.1, method: "ISE", display_order: 8 },
      { name: "Chloride (Cl-)", unit: "mEq/L", default_min: 98, default_max: 106, method: "ISE", display_order: 9 },
      { name: "Calcium", unit: "mg/dL", default_min: 8.5, default_max: 10.5, method: "Arsenazo III", display_order: 10 },
      { name: "Phosphorus", unit: "mg/dL", default_min: 2.5, default_max: 4.5, method: "Phosphomolybdate", display_order: 11 },
      { name: "Magnesium", unit: "mg/dL", default_min: 1.7, default_max: 2.2, method: "Xylidyl Blue", display_order: 12 },
    ],
  },
  {
    panel: { name: "Thyroid Profile (T3, T4, TSH)", category: "Thyroid", sample_type: "Serum", method: "CLIA", price: 650, report_time: "Same Day" },
    parameters: [
      { name: "T3 (Triiodothyronine)", unit: "ng/dL", default_min: 80, default_max: 200, method: "CLIA", display_order: 1 },
      { name: "T4 (Thyroxine)", unit: "µg/dL", default_min: 4.5, default_max: 12, method: "CLIA", display_order: 2 },
      { name: "Free T3 (FT3)", unit: "pg/mL", default_min: 2.3, default_max: 4.2, method: "CLIA", display_order: 3 },
      { name: "Free T4 (FT4)", unit: "ng/dL", default_min: 0.8, default_max: 1.8, method: "CLIA", display_order: 4 },
      { name: "TSH (Thyroid Stimulating Hormone)", unit: "µIU/mL", default_min: 0.4, default_max: 4.0, method: "CLIA", display_order: 5 },
    ],
  },
  {
    panel: { name: "Urine Routine & Microscopy", category: "Urine", sample_type: "Urine (Midstream)", method: "Microscopy + Dipstick", price: 100, report_time: "Same Day" },
    parameters: [
      { name: "Color", unit: null, default_min: null, default_max: null, method: "Visual", display_order: 1 },
      { name: "Appearance", unit: null, default_min: null, default_max: null, method: "Visual", display_order: 2 },
      { name: "Volume", unit: "mL", default_min: null, default_max: null, method: "Visual", display_order: 3 },
      { name: "Odour", unit: null, default_min: null, default_max: null, method: "Visual", display_order: 4 },
      { name: "pH", unit: "", default_min: 4.5, default_max: 8.0, method: "Dipstick", display_order: 5 },
      { name: "Specific Gravity", unit: "", default_min: 1.005, default_max: 1.030, method: "Dipstick", display_order: 6 },
      { name: "Protein", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 7 },
      { name: "Glucose", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 8 },
      { name: "Ketones", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 9 },
      { name: "Bilirubin", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 10 },
      { name: "Urobilinogen", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 11 },
      { name: "Blood", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 12 },
      { name: "Nitrite", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 13 },
      { name: "Leukocyte Esterase", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 14 },
      { name: "Pus Cells", unit: "/HPF", default_min: 0, default_max: 5, method: "Microscopy", display_order: 15 },
      { name: "RBCs", unit: "/HPF", default_min: 0, default_max: 2, method: "Microscopy", display_order: 16 },
      { name: "Epithelial Cells", unit: "/HPF", default_min: null, default_max: null, method: "Microscopy", display_order: 17 },
      { name: "Casts", unit: null, default_min: null, default_max: null, method: "Microscopy", display_order: 18 },
      { name: "Crystals", unit: null, default_min: null, default_max: null, method: "Microscopy", display_order: 19 },
      { name: "Bacteria", unit: null, default_min: null, default_max: null, method: "Microscopy", display_order: 20 },
      { name: "Yeast", unit: null, default_min: null, default_max: null, method: "Microscopy", display_order: 21 },
      { name: "Amorphous Deposits", unit: null, default_min: null, default_max: null, method: "Microscopy", display_order: 22 },
    ],
  },
  {
    panel: { name: "Widal Test", category: "Serology", sample_type: "Serum", method: "Slide Agglutination", price: 200, report_time: "Same Day" },
    parameters: [
      { name: "S. Typhi O", unit: "Titre", default_min: null, default_max: null, method: "Agglutination", display_order: 1 },
      { name: "S. Typhi H", unit: "Titre", default_min: null, default_max: null, method: "Agglutination", display_order: 2 },
      { name: "S. Paratyphi AH", unit: "Titre", default_min: null, default_max: null, method: "Agglutination", display_order: 3 },
      { name: "S. Paratyphi BH", unit: "Titre", default_min: null, default_max: null, method: "Agglutination", display_order: 4 },
    ],
  },
  {
    panel: { name: "Iron Studies", category: "Biochemistry", sample_type: "Serum", method: "Colorimetric", price: 500, report_time: "Same Day" },
    parameters: [
      { name: "Serum Iron", unit: "µg/dL", default_min: 60, default_max: 170, method: "Colorimetric", display_order: 1 },
      { name: "TIBC", unit: "µg/dL", default_min: 250, default_max: 370, method: "Colorimetric", display_order: 2 },
      { name: "UIBC", unit: "µg/dL", default_min: 150, default_max: 300, method: "Calculated", display_order: 3 },
      { name: "Transferrin Saturation", unit: "%", default_min: 20, default_max: 50, method: "Calculated", display_order: 4 },
      { name: "Ferritin", unit: "ng/mL", default_min: 12, default_max: 300, method: "CLIA", display_order: 5 },
    ],
  },
  {
    panel: { name: "Electrolyte Panel", category: "Biochemistry", sample_type: "Serum", method: "ISE", price: 400, report_time: "Same Day" },
    parameters: [
      { name: "Sodium (Na+)", unit: "mEq/L", default_min: 136, default_max: 145, method: "ISE", display_order: 1 },
      { name: "Potassium (K+)", unit: "mEq/L", default_min: 3.5, default_max: 5.1, method: "ISE", display_order: 2 },
      { name: "Chloride (Cl-)", unit: "mEq/L", default_min: 98, default_max: 106, method: "ISE", display_order: 3 },
      { name: "Bicarbonate (HCO3-)", unit: "mEq/L", default_min: 22, default_max: 28, method: "Enzymatic", display_order: 4 },
      { name: "Anion Gap", unit: "mEq/L", default_min: 8, default_max: 16, method: "Calculated", display_order: 5 },
      { name: "Calcium", unit: "mg/dL", default_min: 8.5, default_max: 10.5, method: "Arsenazo III", display_order: 6 },
      { name: "Magnesium", unit: "mg/dL", default_min: 1.7, default_max: 2.2, method: "Xylidyl Blue", display_order: 7 },
      { name: "Phosphorus", unit: "mg/dL", default_min: 2.5, default_max: 4.5, method: "Phosphomolybdate", display_order: 8 },
    ],
  },
  {
    panel: { name: "Coagulation Profile", category: "Hematology", sample_type: "Blood (Citrate)", method: "Clot-based", price: 550, report_time: "Same Day" },
    parameters: [
      { name: "Prothrombin Time (PT)", unit: "sec", default_min: 11, default_max: 13.5, method: "Clot-based", display_order: 1 },
      { name: "Control PT", unit: "sec", default_min: 11, default_max: 13.5, method: "Clot-based", display_order: 2 },
      { name: "INR", unit: "", default_min: 0.8, default_max: 1.2, method: "Calculated", display_order: 3 },
      { name: "aPTT", unit: "sec", default_min: 25, default_max: 35, method: "Clot-based", display_order: 4 },
      { name: "Control aPTT", unit: "sec", default_min: 25, default_max: 35, method: "Clot-based", display_order: 5 },
      { name: "Bleeding Time (BT)", unit: "min", default_min: 2, default_max: 7, method: "Ivy", display_order: 6 },
      { name: "Clotting Time (CT)", unit: "min", default_min: 4, default_max: 10, method: "Lee-White", display_order: 7 },
    ],
  },
  {
    panel: { name: "Diabetic Profile", category: "Biochemistry", sample_type: "Blood (Fluoride/EDTA)", method: "Multiple", price: 700, report_time: "Same Day" },
    parameters: [
      { name: "Blood Sugar Fasting (FBS)", unit: "mg/dL", default_min: 70, default_max: 100, method: "GOD-POD", display_order: 1 },
      { name: "Blood Sugar PP (PPBS)", unit: "mg/dL", default_min: 70, default_max: 140, method: "GOD-POD", display_order: 2 },
      { name: "Blood Sugar Random (RBS)", unit: "mg/dL", default_min: 70, default_max: 140, method: "GOD-POD", display_order: 3 },
      { name: "HbA1c (Glycated Hemoglobin)", unit: "%", default_min: 4, default_max: 5.6, method: "HPLC", display_order: 4 },
      { name: "Estimated Average Glucose (eAG)", unit: "mg/dL", default_min: 70, default_max: 126, method: "Calculated", display_order: 5 },
      { name: "Urine Sugar", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 6 },
      { name: "Urine Ketones", unit: null, default_min: null, default_max: null, method: "Dipstick", display_order: 7 },
    ],
  },
];

// Standalone tests (single result)
const standaloneTests = [
  // Hematology
  { name: "ESR (Erythrocyte Sedimentation Rate)", category: "Hematology", sample_type: "Blood (EDTA)", unit: "mm/hr", default_min: 0, default_max: 20, method: "Westergren", price: 100, report_time: "1 Hour" },
  { name: "Peripheral Blood Smear", category: "Hematology", sample_type: "Blood (EDTA)", unit: null, default_min: null, default_max: null, method: "Microscopy", price: 200, report_time: "Same Day" },

  // Biochemistry
  { name: "Blood Sugar Fasting (FBS)", category: "Biochemistry", sample_type: "Blood (Fluoride)", unit: "mg/dL", default_min: 70, default_max: 100, method: "GOD-POD", price: 80, report_time: "Same Day" },
  { name: "Blood Sugar PP (PPBS)", category: "Biochemistry", sample_type: "Blood (Fluoride)", unit: "mg/dL", default_min: 70, default_max: 140, method: "GOD-POD", price: 80, report_time: "Same Day" },
  { name: "Blood Sugar Random (RBS)", category: "Biochemistry", sample_type: "Blood (Fluoride)", unit: "mg/dL", default_min: 70, default_max: 140, method: "GOD-POD", price: 80, report_time: "Same Day" },
  { name: "HbA1c (Glycated Hemoglobin)", category: "Biochemistry", sample_type: "Blood (EDTA)", unit: "%", default_min: 4, default_max: 5.6, method: "HPLC", price: 450, report_time: "Same Day" },

  // Thyroid (individual)
  { name: "TSH", category: "Thyroid", sample_type: "Serum", unit: "µIU/mL", default_min: 0.4, default_max: 4.0, method: "CLIA", price: 300, report_time: "Same Day" },

  // Serology
  { name: "CRP (C-Reactive Protein)", category: "Serology", sample_type: "Serum", unit: "mg/L", default_min: 0, default_max: 6, method: "Latex Agglutination", price: 250, report_time: "Same Day" },
  { name: "RA Factor", category: "Serology", sample_type: "Serum", unit: "IU/mL", default_min: 0, default_max: 14, method: "Latex", price: 250, report_time: "Same Day" },
  { name: "ASO Titre", category: "Serology", sample_type: "Serum", unit: "IU/mL", default_min: 0, default_max: 200, method: "Latex", price: 250, report_time: "Same Day" },
  { name: "Dengue NS1 Antigen", category: "Serology", sample_type: "Serum", unit: null, default_min: null, default_max: null, method: "Rapid Card", price: 500, report_time: "Same Day" },
  { name: "Malaria Antigen (Rapid)", category: "Serology", sample_type: "Blood", unit: null, default_min: null, default_max: null, method: "Rapid Card", price: 300, report_time: "30 Minutes" },
  { name: "HIV I & II (Rapid)", category: "Serology", sample_type: "Serum", unit: null, default_min: null, default_max: null, method: "Rapid Card", price: 300, report_time: "30 Minutes" },
  { name: "HBsAg (Hepatitis B)", category: "Serology", sample_type: "Serum", unit: null, default_min: null, default_max: null, method: "Rapid Card", price: 300, report_time: "30 Minutes" },

  // Vitamins
  { name: "Vitamin D (25-OH)", category: "Vitamins", sample_type: "Serum", unit: "ng/mL", default_min: 30, default_max: 100, method: "CLIA", price: 800, report_time: "Next Day" },
  { name: "Vitamin B12", category: "Vitamins", sample_type: "Serum", unit: "pg/mL", default_min: 200, default_max: 900, method: "CLIA", price: 700, report_time: "Next Day" },
  { name: "Folic Acid", category: "Vitamins", sample_type: "Serum", unit: "ng/mL", default_min: 3, default_max: 17, method: "CLIA", price: 600, report_time: "Next Day" },
];

/** SQLite does not alter existing tables on sync — add catalogue columns if missing. */
async function ensureLabSettingsCatalogueColumns() {
  if (!isSqlite) return;
  try {
    const [cols] = await sequelize.query("PRAGMA table_info(lab_settings)");
    const names = new Set((cols as { name: string }[]).map((c) => c.name));
    if (!names.has("catalogue_seeded")) {
      await sequelize.query(
        "ALTER TABLE lab_settings ADD COLUMN catalogue_seeded INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!names.has("catalogue_seeded_at")) {
      await sequelize.query(
        "ALTER TABLE lab_settings ADD COLUMN catalogue_seeded_at DATETIME"
      );
    }
  } catch (err) {
    console.warn("Could not ensure lab_settings catalogue columns", err);
  }
}

async function getOrCreateLabSettings() {
  let settings = await LabSettings.findOne();
  if (!settings) {
    settings = await LabSettings.create({
      lab_name: "MyLab Diagnostics & Pathology",
      address: "123 Health Street, Medical Complex",
      phone: "+91 98765 43210",
      email: "info@mylab.com",
      header_text: "Accurate Results. Trusted Care.",
      footer_text:
        "This is a computer-generated report and does not require a physical signature unless specified.",
      catalogue_seeded: false,
      catalogue_seeded_at: null,
    });
    console.log("Default lab settings created");
  }
  return settings;
}

async function markCatalogueSeeded() {
  const settings = await getOrCreateLabSettings();
  if (!settings.catalogue_seeded) {
    settings.catalogue_seeded = true;
    settings.catalogue_seeded_at = new Date();
    await settings.save();
  }
}

/** Apply built-in panels + standalone tests (does not clear existing rows). */
export async function seedFactoryCatalogue() {
  for (const { panel, parameters } of panelTests) {
    const createdPanel = await TestDefinition.create({
      name: panel.name,
      category: panel.category,
      sample_type: panel.sample_type,
      method: panel.method,
      price: panel.price,
      report_time: panel.report_time,
      is_panel: true,
      parent_id: null,
      display_order: 0,
      unit: null,
      default_min: null,
      default_max: null,
    } as any);

    for (const param of parameters) {
      await TestDefinition.create({
        name: param.name,
        category: panel.category,
        sample_type: panel.sample_type,
        method: param.method || panel.method,
        price: 0,
        report_time: panel.report_time,
        is_panel: false,
        parent_id: createdPanel.id,
        display_order: param.display_order,
        unit: param.unit || null,
        default_min: param.default_min ?? null,
        default_max: param.default_max ?? null,
      } as any);
    }
  }

  for (const test of standaloneTests) {
    await TestDefinition.create({
      ...test,
      is_panel: false,
      parent_id: null,
      display_order: 0,
    } as any);
  }

  console.log(
    `Seeded ${panelTests.length} panel tests and ${standaloneTests.length} standalone tests`
  );
}

/**
 * Doctor factory reset: drop unused catalogue rows, detach rows still referenced
 * by reports, then re-apply the built-in seed once.
 */
export async function resetFactoryCatalogue() {
  const usedRows = await ReportItem.findAll({
    attributes: ["test_definition_id"],
  });
  const usedIds = new Set(
    usedRows.map((r) => r.test_definition_id).filter((id) => id != null)
  );

  const all = await TestDefinition.findAll();
  for (const row of all) {
    if (usedIds.has(row.id)) {
      row.parent_id = null;
      row.is_panel = false;
      await row.save();
    } else {
      try {
        await row.destroy();
      } catch (err) {
        console.warn(`Could not delete test #${row.id}; detaching`, err);
        row.parent_id = null;
        row.is_panel = false;
        await row.save();
      }
    }
  }

  await seedFactoryCatalogue();
  const settings = await getOrCreateLabSettings();
  settings.catalogue_seeded = true;
  settings.catalogue_seeded_at = new Date();
  await settings.save();
}

export const initDatabase = async () => {
  await sequelize.authenticate();

  // Set up associations before sync
  associateReport();

  // SQLite alter support is limited; create-if-missing is enough for desktop.
  const syncOpts = isSqlite ? {} : { alter: true };
  await User.sync(syncOpts);
  await Patient.sync();
  await TestDefinition.sync(syncOpts);
  await Report.sync(syncOpts);
  await ReportItem.sync(syncOpts);
  await LabSettings.sync(syncOpts);
  await AnalyzerInbox.sync(syncOpts);
  await ensureLabSettingsCatalogueColumns();

  // Seed default doctor if not exists
  const defaultDoctor = await User.findOne({ where: { email: "doctor@mylab.com" } });
  if (!defaultDoctor) {
    const hashedPassword = await hashPassword("password");
    await User.create({
      email: "doctor@mylab.com",
      password_hash: hashedPassword,
      role: "doctor",
      signature_image: null,
    });
    console.log("Default doctor created: doctor@mylab.com / password");
  }

  const settings = await getOrCreateLabSettings();
  const panelCount = await TestDefinition.count({ where: { is_panel: true } });

  // Existing lab DBs: never re-apply seed; mark as lab-owned immediately.
  if (panelCount > 0) {
    if (!settings.catalogue_seeded) {
      await markCatalogueSeeded();
      console.log("Catalogue marked lab-owned (existing panels; no further seed sync)");
    }
  } else if (
    !settings.catalogue_seeded &&
    process.env.MYLAB_DEFER_CATALOGUE_SEED !== "1"
  ) {
    // First boot (or empty DB after wipe): seed once, then never again.
    await seedFactoryCatalogue();
    await markCatalogueSeeded();
  } else if (process.env.MYLAB_DEFER_CATALOGUE_SEED === "1") {
    console.log(
      "Catalogue seed deferred (waiting for Drive restore decision)"
    );
  }

  // Clean accidental placeholder params from failed edits (safe, non-seed)
  const junk = await TestDefinition.findAll({ where: { is_panel: false } });
  for (const row of junk) {
    if (!/^New Param\b/i.test(row.name)) continue;
    try {
      await row.destroy();
    } catch {
      row.parent_id = null;
      await row.save();
    }
  }
};

export {
  sequelize,
  User,
  Patient,
  TestDefinition,
  Report,
  ReportItem,
  LabSettings,
  AnalyzerInbox,
};
