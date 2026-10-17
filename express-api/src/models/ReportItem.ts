import { DataTypes, Model } from "sequelize";
import sequelize from "@/lib/sequelize";
import { Report } from "@/models/Report";
import { TestDefinition } from "@/models/TestDefinition";

export class ReportItem extends Model {
  declare id: number;
  declare report_id: number;
  declare test_definition_id: number;
  declare test_name: string;
  declare sample_type: string | null;
  declare result_type: "numeric" | "text" | "boolean";
  declare result_value: string;
  declare unit: string | null;
  declare normal_min: number | null;
  declare normal_max: number | null;
  declare note: string | null;
  declare price: number;
  declare panel_name: string | null;
  declare display_order: number;
}

ReportItem.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    report_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    test_definition_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    test_name: {
      type: DataTypes.STRING(220),
      allowNull: false,
    },
    sample_type: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    result_type: {
      type: DataTypes.ENUM("numeric", "text", "boolean"),
      allowNull: false,
      defaultValue: "text",
    },
    result_value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    unit: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    normal_min: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    normal_max: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    panel_name: {
      type: DataTypes.STRING(220),
      allowNull: true,
      defaultValue: null,
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: "report_items",
    timestamps: true,
  }
);

ReportItem.belongsTo(Report, { foreignKey: "report_id", as: "report" });
ReportItem.belongsTo(TestDefinition, { foreignKey: "test_definition_id", as: "testDefinition" });
