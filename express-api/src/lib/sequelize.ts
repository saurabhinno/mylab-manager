import { Sequelize } from "sequelize";

const DATABASE_URL = process.env.DATABASE_URL || process.env.MYSQL_URL;

let sequelize: Sequelize;

if (DATABASE_URL) {
  // Railway provides a connection URL
  sequelize = new Sequelize(DATABASE_URL, {
    dialect: "mysql",
    dialectModule: require("mysql2"),
    dialectOptions: {
      connectTimeout: 60000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
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

export default sequelize;
