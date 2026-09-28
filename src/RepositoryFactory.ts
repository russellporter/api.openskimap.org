import type * as GeoJSON from "geojson";
import { Pool } from "pg";

import * as Config from "./Config.ts";
import { computeBounds } from "./geometry.ts";
import { Repository } from "./Repository.ts";

export default async function getRepository(databaseName?: string): Promise<Repository> {
  const pool = new Pool({
    host: Config.postgres.host,
    user: Config.postgres.user,
    password: Config.postgres.password,
    database: databaseName ?? Config.postgres.database,
    port: Config.postgres.port,
    max: 20,
  });

  // Ensure required extensions are installed
  await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  await pool.query("CREATE EXTENSION IF NOT EXISTS unaccent");

  // Create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS features (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(20) NOT NULL CHECK (type IN ('skiArea', 'lift', 'run', 'spot')),
      searchable_text TEXT NOT NULL,
      searchable_text_ts tsvector,
      -- Geometry is optional for non-geographic records.
      geometry JSONB,
      properties JSONB NOT NULL,
      rank DECIMAL NOT NULL DEFAULT 0,
      import_id UUID NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Migration: remove legacy non-feature rows and restore the feature type constraint.
  await pool.query(`
    DO $$
    BEGIN
      DELETE FROM features WHERE type NOT IN ('skiArea', 'lift', 'run', 'spot');
      ALTER TABLE features DROP CONSTRAINT IF EXISTS features_type_check;
      ALTER TABLE features ADD CONSTRAINT features_type_check CHECK (type IN ('skiArea', 'lift', 'run', 'spot'));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$;
  `);

  // Run migrations before creating indexes
  // Add searchable_text_ts column if it doesn't exist (migration)
  await pool.query(`
    ALTER TABLE features
    ADD COLUMN IF NOT EXISTS searchable_text_ts tsvector
  `);

  // Add rank column if it doesn't exist (migration)
  await pool.query(`
    ALTER TABLE features
    ADD COLUMN IF NOT EXISTS rank DECIMAL NOT NULL DEFAULT 0
  `);

  // Add bounding box columns if they don't exist (migration)
  await pool.query(`
    ALTER TABLE features
    ADD COLUMN IF NOT EXISTS min_lon DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS min_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS max_lon DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS max_lat DOUBLE PRECISION
  `);

  // Populate tsvector for existing rows (migration)
  await pool.query(`
    UPDATE features
    SET searchable_text_ts = to_tsvector('simple', searchable_text)
    WHERE searchable_text_ts IS NULL
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
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_features_bbox
    ON features (min_lon, max_lon, min_lat, max_lat)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_features_properties_sources
    ON features USING GIN((properties->'sources') jsonb_path_ops)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feature_sources (
      feature_id VARCHAR(255) NOT NULL,
      source_type VARCHAR(50) NOT NULL,
      source_id TEXT NOT NULL,
      PRIMARY KEY (feature_id, source_type, source_id),
      FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_feature_sources_lookup
    ON feature_sources(source_type, source_id)
  `);

  // Migration: populate feature_sources from existing features data
  await pool.query(`
    INSERT INTO feature_sources (feature_id, source_type, source_id)
    SELECT
      id AS feature_id,
      src->>'type' AS source_type,
      src->>'id' AS source_id
    FROM features, jsonb_array_elements(properties->'sources') AS src
    WHERE src->>'type' IS NOT NULL
      AND src->>'id' IS NOT NULL
    ON CONFLICT (feature_id, source_type, source_id) DO NOTHING
  `);

  // Migration: backfill bounding boxes for rows imported before the columns existed
  await backfillBounds(pool);

  return new Repository(pool);
}

/** Computes and stores bounding box columns for rows that don't have them yet. */
async function backfillBounds(pool: Pool): Promise<void> {
  const result = await pool.query(
    "SELECT id, geometry FROM features WHERE min_lon IS NULL AND geometry IS NOT NULL"
  );
  if (result.rows.length === 0) {
    return;
  }

  console.log(
    `Backfilling bounding boxes for ${result.rows.length} features...`
  );

  const CHUNK_SIZE = 500;
  for (let start = 0; start < result.rows.length; start += CHUNK_SIZE) {
    const ids: string[] = [];
    const minLons: number[] = [];
    const minLats: number[] = [];
    const maxLons: number[] = [];
    const maxLats: number[] = [];

    for (const row of result.rows.slice(start, start + CHUNK_SIZE)) {
      const bounds = computeBounds(row.geometry as GeoJSON.Geometry | null);
      if (!bounds) {
        continue;
      }
      ids.push(row.id);
      minLons.push(bounds.minLon);
      minLats.push(bounds.minLat);
      maxLons.push(bounds.maxLon);
      maxLats.push(bounds.maxLat);
    }

    if (ids.length === 0) {
      continue;
    }

    await pool.query(
      `UPDATE features AS f
       SET min_lon = v.min_lon,
           min_lat = v.min_lat,
           max_lon = v.max_lon,
           max_lat = v.max_lat
       FROM (
         SELECT unnest($1::varchar[]) AS id,
                unnest($2::float8[]) AS min_lon,
                unnest($3::float8[]) AS min_lat,
                unnest($4::float8[]) AS max_lon,
                unnest($5::float8[]) AS max_lat
       ) AS v
       WHERE f.id = v.id`,
      [ids, minLons, minLats, maxLons, maxLats]
    );
  }

  console.log("Bounding box backfill complete");
}
