import { DataTypes, Model } from "sequelize";
import sequelize from "@/lib/sequelize";

export class LabSettings extends Model {
  declare id: number;
  declare lab_name: string;
  declare address: string | null;
  declare phone: string | null;
  declare email: string | null;
  declare logo_path: string | null;
  declare header_text: string | null;
  declare footer_text: string | null;
}

LabSettings.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    lab_name: {
      type: DataTypes.STRING(220),
      allowNull: false,
      defaultValue: "MyLab Diagnostics",
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },
    logo_path: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    header_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    footer_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "lab_settings",
    timestamps: true,
  }
);
