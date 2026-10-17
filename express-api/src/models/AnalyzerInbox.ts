import { DataTypes, Model } from "sequelize";
import sequelize from "@/lib/sequelize";

export class AnalyzerInbox extends Model {
  declare id: number;
  declare machine_path: string | null;
  declare sample_id: string | null;
  declare patient_name: string | null;
  declare profile_id: string;
  declare raw: string;
  declare parsed_json: string;
  declare status: "new" | "applied" | "ignored";
  declare applied_report_id: number | null;
  declare received_at: Date;
}

AnalyzerInbox.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    machine_path: {
      type: DataTypes.STRING(220),
      allowNull: true,
    },
    sample_id: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    patient_name: {
      type: DataTypes.STRING(220),
      allowNull: true,
    },
    profile_id: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: "cellenium-21",
    },
    raw: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    parsed_json: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      defaultValue: "{}",
    },
    status: {
      type: DataTypes.ENUM("new", "applied", "ignored"),
      allowNull: false,
      defaultValue: "new",
    },
    applied_report_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    received_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "analyzer_inbox",
    timestamps: true,
  }
);
