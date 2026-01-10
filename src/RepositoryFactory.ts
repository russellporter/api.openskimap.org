import { Pool } from "pg";
import * as Config from "./Config";
import { Repository } from "./Repository";

export default async function getRepository(databaseName?: string): Promise<Repository> {
  const pool = new Pool({
    host: Config.postgres.host,
    user: Config.postgres.user,
    password: Config.postgres.password,
    database: databaseName ?? Config.postgres.database,
    port: Config.postgres.port,
    max: 20,
  });

  // Ensure pg_trgm extension is installed
  await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");

  // Create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS features (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(20) NOT NULL CHECK (type IN ('skiArea', 'lift', 'run')),
      searchable_text TEXT NOT NULL,
      searchable_text_ts tsvector,
      geometry JSONB NOT NULL,
      properties JSONB NOT NULL,
      import_id UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Create indexes if not exist
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_features_type ON features(type)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_features_import_id ON features(import_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_features_searchable_text_trgm
    ON features USING GIN(searchable_text gin_trgm_ops)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_features_name
    ON features((properties->>'name'))
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_features_searchable_text_ts
    ON features USING GIN(searchable_text_ts)
  `);

  // Populate tsvector for existing rows (migration)
  await pool.query(`
    UPDATE features
    SET searchable_text_ts = to_tsvector('simple', searchable_text)
    WHERE searchable_text_ts IS NULL
  `);

  return new Repository(pool);
}
