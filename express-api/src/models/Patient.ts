import { DataTypes, Model } from "sequelize";
import sequelize from "@/lib/sequelize";

export class Patient extends Model {
  declare id: number;
  declare name: string;
  declare age: number;
  declare weight: number;
  declare referred_by: string | null;
}

Patient.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    age: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    weight: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    referred_by: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "patients",
    timestamps: true,
  }
);
