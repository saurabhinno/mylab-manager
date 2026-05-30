import { DataTypes, Model } from "sequelize";
import sequelize from "@/lib/sequelize";

export class TestDefinition extends Model {
  declare id: number;
  declare name: string;
  declare category: string;
  declare sample_type: string;
  declare method: string | null;
  declare default_min: number | null;
  declare default_max: number | null;
  declare unit: string | null;
  declare price: number;
  declare report_time: string | null;
  declare is_panel: boolean;
  declare parent_id: number | null;
  declare display_order: number;
}

TestDefinition.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(220),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "General",
    },
    sample_type: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: "Blood",
    },
    method: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    default_min: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    default_max: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    report_time: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    is_panel: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    parent_id: {
      type: DataTypes.INTEGER.UNSIGNED,
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
    tableName: "test_definitions",
    timestamps: true,
  }
);

// Self-referencing association
TestDefinition.hasMany(TestDefinition, { as: "parameters", foreignKey: "parent_id" });
TestDefinition.belongsTo(TestDefinition, { as: "panel", foreignKey: "parent_id" });
