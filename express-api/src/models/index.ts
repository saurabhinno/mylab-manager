import sequelize from "@/lib/sequelize";
import { User } from "@/models/User";
import { Patient } from "@/models/Patient";
import { TestDefinition } from "@/models/TestDefinition";
import { Report, associateReport } from "@/models/Report";
import { ReportItem } from "@/models/ReportItem";
import { LabSettings } from "@/models/LabSettings";
import { hashPassword } from "@/lib/session";

const defaultTests = [
  // Hematology
  { name: "Complete Blood Count (CBC)", category: "Hematology", sample_type: "Blood (EDTA)", unit: null, default_min: null, default_max: null, method: "Automated Cell Counter", price: 350, report_time: "Same Day" },
  { name: "Hemoglobin (Hb)", category: "Hematology", sample_type: "Blood (EDTA)", unit: "g/dL", default_min: 12, default_max: 17, method: "Cyanmethemoglobin", price: 100, report_time: "Same Day" },
  { name: "Platelet Count", category: "Hematology", sample_type: "Blood (EDTA)", unit: "lakhs/µL", default_min: 1.5, default_max: 4.0, method: "Automated", price: 150, report_time: "Same Day" },
  { name: "ESR (Erythrocyte Sedimentation Rate)", category: "Hematology", sample_type: "Blood (EDTA)", unit: "mm/hr", default_min: 0, default_max: 20, method: "Westergren", price: 100, report_time: "1 Hour" },
  { name: "Peripheral Blood Smear", category: "Hematology", sample_type: "Blood (EDTA)", unit: null, default_min: null, default_max: null, method: "Microscopy", price: 200, report_time: "Same Day" },

  // Biochemistry
  { name: "Blood Sugar Fasting (FBS)", category: "Biochemistry", sample_type: "Blood (Fluoride)", unit: "mg/dL", default_min: 70, default_max: 100, method: "GOD-POD", price: 80, report_time: "Same Day" },
  { name: "Blood Sugar PP (PPBS)", category: "Biochemistry", sample_type: "Blood (Fluoride)", unit: "mg/dL", default_min: 70, default_max: 140, method: "GOD-POD", price: 80, report_time: "Same Day" },
  { name: "HbA1c (Glycated Hemoglobin)", category: "Biochemistry", sample_type: "Blood (EDTA)", unit: "%", default_min: 4, default_max: 5.6, method: "HPLC", price: 450, report_time: "Same Day" },
  { name: "Blood Urea", category: "Biochemistry", sample_type: "Serum", unit: "mg/dL", default_min: 15, default_max: 40, method: "Urease-GLDH", price: 120, report_time: "Same Day" },
  { name: "Serum Creatinine", category: "Biochemistry", sample_type: "Serum", unit: "mg/dL", default_min: 0.6, default_max: 1.2, method: "Jaffe's", price: 120, report_time: "Same Day" },
  { name: "Uric Acid", category: "Biochemistry", sample_type: "Serum", unit: "mg/dL", default_min: 3.5, default_max: 7.2, method: "Uricase", price: 150, report_time: "Same Day" },
  { name: "Total Cholesterol", category: "Biochemistry", sample_type: "Serum", unit: "mg/dL", default_min: 0, default_max: 200, method: "CHOD-PAP", price: 150, report_time: "Same Day" },
  { name: "Triglycerides", category: "Biochemistry", sample_type: "Serum", unit: "mg/dL", default_min: 0, default_max: 150, method: "GPO-PAP", price: 150, report_time: "Same Day" },
  { name: "HDL Cholesterol", category: "Biochemistry", sample_type: "Serum", unit: "mg/dL", default_min: 40, default_max: 60, method: "Direct", price: 180, report_time: "Same Day" },
  { name: "LDL Cholesterol", category: "Biochemistry", sample_type: "Serum", unit: "mg/dL", default_min: 0, default_max: 100, method: "Calculated", price: 180, report_time: "Same Day" },
  { name: "Lipid Profile", category: "Biochemistry", sample_type: "Serum", unit: null, default_min: null, default_max: null, method: "Enzymatic", price: 500, report_time: "Same Day" },
  { name: "SGOT (AST)", category: "Biochemistry", sample_type: "Serum", unit: "U/L", default_min: 5, default_max: 40, method: "IFCC", price: 150, report_time: "Same Day" },
  { name: "SGPT (ALT)", category: "Biochemistry", sample_type: "Serum", unit: "U/L", default_min: 7, default_max: 56, method: "IFCC", price: 150, report_time: "Same Day" },
  { name: "Total Bilirubin", category: "Biochemistry", sample_type: "Serum", unit: "mg/dL", default_min: 0.1, default_max: 1.2, method: "Diazo", price: 120, report_time: "Same Day" },
  { name: "Liver Function Test (LFT)", category: "Biochemistry", sample_type: "Serum", unit: null, default_min: null, default_max: null, method: "Multiple", price: 600, report_time: "Same Day" },
  { name: "Kidney Function Test (KFT/RFT)", category: "Biochemistry", sample_type: "Serum", unit: null, default_min: null, default_max: null, method: "Multiple", price: 600, report_time: "Same Day" },

  // Thyroid
  { name: "TSH (Thyroid Stimulating Hormone)", category: "Thyroid", sample_type: "Serum", unit: "µIU/mL", default_min: 0.4, default_max: 4.0, method: "CLIA", price: 300, report_time: "Same Day" },
  { name: "T3 (Triiodothyronine)", category: "Thyroid", sample_type: "Serum", unit: "ng/dL", default_min: 80, default_max: 200, method: "CLIA", price: 250, report_time: "Same Day" },
  { name: "T4 (Thyroxine)", category: "Thyroid", sample_type: "Serum", unit: "µg/dL", default_min: 4.5, default_max: 12, method: "CLIA", price: 250, report_time: "Same Day" },
  { name: "Thyroid Profile (T3, T4, TSH)", category: "Thyroid", sample_type: "Serum", unit: null, default_min: null, default_max: null, method: "CLIA", price: 650, report_time: "Same Day" },

  // Urine
  { name: "Urine Routine & Microscopy", category: "Urine", sample_type: "Urine (Midstream)", unit: null, default_min: null, default_max: null, method: "Microscopy + Dipstick", price: 100, report_time: "Same Day" },

  // Serology
  { name: "Widal Test", category: "Serology", sample_type: "Serum", unit: null, default_min: null, default_max: null, method: "Slide Agglutination", price: 200, report_time: "Same Day" },
  { name: "CRP (C-Reactive Protein)", category: "Serology", sample_type: "Serum", unit: "mg/L", default_min: 0, default_max: 6, method: "Latex Agglutination", price: 250, report_time: "Same Day" },
  { name: "RA Factor", category: "Serology", sample_type: "Serum", unit: "IU/mL", default_min: 0, default_max: 14, method: "Latex", price: 250, report_time: "Same Day" },
  { name: "Dengue NS1 Antigen", category: "Serology", sample_type: "Serum", unit: null, default_min: null, default_max: null, method: "Rapid Card", price: 500, report_time: "Same Day" },
  { name: "Malaria Antigen (Rapid)", category: "Serology", sample_type: "Blood", unit: null, default_min: null, default_max: null, method: "Rapid Card", price: 300, report_time: "30 Minutes" },

  // Vitamins
  { name: "Vitamin D (25-OH)", category: "Vitamins", sample_type: "Serum", unit: "ng/mL", default_min: 30, default_max: 100, method: "CLIA", price: 800, report_time: "Next Day" },
  { name: "Vitamin B12", category: "Vitamins", sample_type: "Serum", unit: "pg/mL", default_min: 200, default_max: 900, method: "CLIA", price: 700, report_time: "Next Day" },
  { name: "Iron Studies (Serum Iron)", category: "Vitamins", sample_type: "Serum", unit: "µg/dL", default_min: 60, default_max: 170, method: "Colorimetric", price: 300, report_time: "Same Day" },
];

export const initDatabase = async () => {
  await sequelize.authenticate();

  // Set up associations before sync
  associateReport();

  await User.sync({ alter: true });
  await Patient.sync();
  await TestDefinition.sync({ alter: true });
  await Report.sync({ alter: true });
  await ReportItem.sync({ alter: true });
  await LabSettings.sync({ alter: true });

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

  // Seed default tests if table is empty
  const testCount = await TestDefinition.count();
  if (testCount === 0) {
    await TestDefinition.bulkCreate(defaultTests as any[]);
    console.log(`Seeded ${defaultTests.length} default tests`);
  }

  // Seed default lab settings
  const settingsCount = await LabSettings.count();
  if (settingsCount === 0) {
    await LabSettings.create({
      lab_name: "MyLab Diagnostics & Pathology",
      address: "123 Health Street, Medical Complex",
      phone: "+91 98765 43210",
      email: "info@mylab.com",
      header_text: "Accurate Results. Trusted Care.",
      footer_text: "This is a computer-generated report and does not require a physical signature unless specified.",
    });
    console.log("Default lab settings created");
  }
};

export { sequelize, User, Patient, TestDefinition, Report, ReportItem, LabSettings };
