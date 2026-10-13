import fs from "fs";
import path from "path";
import { Sequelize } from "sequelize";

const useSqlite =
  process.env.DB_DIALECT === "sqlite" ||
  !!process.env.SQLITE_PATH ||
  process.env.DESKTOP === "1" ||
  (!process.env.DATABASE_URL && !process.env.MYSQL_URL && !process.env.MYSQL_HOST);

let sequelize: Sequelize;

if (useSqlite) {
  const storage =
    process.env.SQLITE_PATH ||
    path.join(process.cwd(), "data", "mylab.sqlite");

  fs.mkdirSync(path.dirname(storage), { recursive: true });

  sequelize = new Sequelize({
    dialect: "sqlite",
    storage,
    logging: false,
    define: { underscored: true, freezeTableName: false },
  });

  console.log(`Using SQLite database at ${storage}`);
} else {
  const DATABASE_URL = process.env.DATABASE_URL || process.env.MYSQL_URL;

  if (DATABASE_URL) {
    sequelize = new Sequelize(DATABASE_URL, {
      dialect: "mysql",
      dialectModule: require("mysql2"),
      dialectOptions: {
        connectTimeout: 60000,
        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : undefined,
      },
      pool: { max: 5, min: 0, acquire: 60000, idle: 60000 },
      logging: false,
      define: { underscored: true, freezeTableName: false },
    });
  } else {
    const {
      MYSQL_HOST = "127.0.0.1",
      MYSQL_PORT = "3306",
      MYSQL_DATABASE = "mylab",
      MYSQL_USER = "root",
      MYSQL_PASSWORD = "password",
    } = process.env;

    sequelize = new Sequelize(MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, {
      host: MYSQL_HOST,
      port: Number(MYSQL_PORT),
      dialect: "mysql",
      dialectModule: require("mysql2"),
      dialectOptions: { connectTimeout: 60000 },
      pool: { max: 5, min: 0, acquire: 60000, idle: 60000 },
      logging: false,
      define: { underscored: true, freezeTableName: false },
    });
  }
}

export const isSqlite = useSqlite;
export default sequelize;
