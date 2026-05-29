import { DataTypes, Model } from "sequelize";
import sequelize from "@/lib/sequelize";

export class User extends Model {
  declare id: number;
  declare email: string;
  declare name: string | null;
  declare password_hash: string;
  declare role: "doctor" | "compounder";
  declare signature_image: string | null;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("doctor", "compounder"),
      allowNull: false,
      defaultValue: "compounder",
    },
    signature_image: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "users",
    timestamps: true,
  }
);
