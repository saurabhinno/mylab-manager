import { DataTypes, Model } from "sequelize";
import sequelize from "@/lib/sequelize";
import { User } from "@/models/User";

export class Report extends Model {
  declare id: number;
  declare date: Date;
  declare patient_name: string;
  declare patient_age: number;
  declare patient_weight: number;
  declare patient_gender: string | null;
  declare patient_phone: string | null;
  declare referred_by: string | null;
  declare total_price: number;
  declare payment_status: "paid" | "unpaid";
  declare status: "sample_collected" | "results_entered" | "finalized";
  declare sample_collected_at: Date | null;
  declare compounder_id: number;
  declare doctor_id: number;
}

Report.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    patient_name: {
      type: DataTypes.STRING(220),
      allowNull: false,
    },
    patient_age: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    patient_weight: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    patient_gender: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    patient_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    referred_by: {
      type: DataTypes.STRING(220),
      allowNull: true,
    },
    total_price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    payment_status: {
      type: DataTypes.ENUM("paid", "unpaid"),
      allowNull: false,
      defaultValue: "unpaid",
    },
    status: {
      type: DataTypes.ENUM("sample_collected", "results_entered", "finalized"),
      allowNull: false,
      defaultValue: "sample_collected",
    },
    sample_collected_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    compounder_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    doctor_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "reports",
    timestamps: true,
  }
);

Report.belongsTo(User, { foreignKey: "compounder_id", as: "compounder" });
Report.belongsTo(User, { foreignKey: "doctor_id", as: "doctor" });

let associated = false;
export function associateReport() {
  if (associated) return;
  associated = true;
  const { ReportItem } = require("@/models/ReportItem");
  Report.hasMany(ReportItem, { foreignKey: "report_id", as: "reportItems" });
}
