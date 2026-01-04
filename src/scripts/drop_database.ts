import { Pool } from "pg";
import * as Config from "../Config";

(async () => {
  try {
    const pool = new Pool({
      host: Config.postgres.host,
      user: Config.postgres.user,
      password: Config.postgres.password,
      database: Config.postgres.database,
      port: Config.postgres.port,
    });

    await pool.query("DROP TABLE IF EXISTS features CASCADE");
    await pool.end();

    console.log("Database dropped successfully");
  } catch (e) {
    console.error("Failed dropping database", e);
    process.exit(1);
  }
})();
