import { SkiAreaSummaryFeature } from "openskidata-format";
import { Pool } from "pg";
import { calculateRank } from "./RankCalculator";
import { Feature } from "./types";

export class Repository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  has = async (id: string): Promise<boolean> => {
    const result = await this.pool.query(
      "SELECT EXISTS(SELECT 1 FROM features WHERE id = $1) as exists",
      [id]
    );
    return result.rows[0].exists;
  };

  get = async (id: string): Promise<Feature> => {
    const result = await this.pool.query(
      `SELECT id, type, geometry, properties
       FROM features
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Feature ${id} not found`);
    }

    return rowToFeature(result.rows[0]);
  };

  getBySourceId = async (sourceType: string, sourceId: string): Promise<Feature> => {
    const result = await this.pool.query(
      `SELECT f.id, f.type, f.geometry, f.properties
       FROM features f
       JOIN feature_sources fs ON f.id = fs.feature_id
       WHERE fs.source_type = $1 AND fs.source_id = $2
       LIMIT 1`,
      [sourceType, sourceId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Feature with source ${sourceType}/${sourceId} not found`);
    }

    return rowToFeature(result.rows[0]);
  };

  search = async (text: string, limit: number): Promise<Feature[]> => {
    const searchLower = text.toLowerCase();

    // Prepare tsquery with prefix matching for all tokens
    // "garmisch classic" → "garmisch:* & classic:*"
    const tokens = searchLower.split(/\s+/).filter(t => t.length > 0);
    const tsquery = tokens.map(t => `${t}:*`).join(' & ');

    // Skip ILIKE fallback for short queries (< 3 chars) since trigram indexes
    // need at least 3 characters to be effective
    const useTrigramFallback = searchLower.length >= 3;

    const result = useTrigramFallback
      ? await this.searchWithFallback(searchLower, tsquery, limit)
      : await this.searchTsvectorOnly(searchLower, tsquery, limit);

    return result.rows.map(rowToFeature);
  };

  private searchTsvectorOnly = async (
    searchLower: string,
    tsquery: string,
    limit: number
  ) => {
    return this.pool.query(
      `SELECT id, type, geometry, properties FROM (
         SELECT
           id,
           type,
           geometry,
           properties,
           rank,
           CASE
             WHEN LOWER(properties->>'name') = $1 THEN 3
             WHEN LOWER(properties->>'name') LIKE $1 || '%' THEN 2
             WHEN LOWER(properties->>'name') LIKE '%' || $1 || '%' THEN 1
             ELSE 0
           END AS name_score,
           CASE
             WHEN type = 'skiArea' THEN 3
             WHEN type = 'lift' THEN 2
             WHEN type = 'run' THEN 1
             ELSE 0
           END AS type_score
         FROM features
         WHERE searchable_text_ts @@ to_tsquery('simple', $2)
           AND type != 'spot'
       ) AS results
       ORDER BY (type_score * 10 + name_score + 20 + rank) DESC
       LIMIT $3`,
      [searchLower, tsquery, limit]
    );
  };

  private searchWithFallback = async (
    searchLower: string,
    tsquery: string,
    limit: number
  ) => {
    return this.pool.query(
      `WITH primary_results AS (
         -- Primary: tsvector prefix search (word boundaries)
         SELECT
           id,
           type,
           geometry,
           properties,
           rank,
           CASE
             WHEN LOWER(properties->>'name') = $1 THEN 3
             WHEN LOWER(properties->>'name') LIKE $1 || '%' THEN 2
             WHEN LOWER(properties->>'name') LIKE '%' || $1 || '%' THEN 1
             ELSE 0
           END AS name_score,
           CASE
             WHEN type = 'skiArea' THEN 3
             WHEN type = 'lift' THEN 2
             WHEN type = 'run' THEN 1
             ELSE 0
           END AS type_score,
           20 AS boundary_bonus
         FROM features
         WHERE searchable_text_ts @@ to_tsquery('simple', $2)
           AND type != 'spot'
       ),
       fallback_results AS (
         -- Fallback: ILIKE search (substring matching anywhere)
         SELECT
           id,
           type,
           geometry,
           properties,
           rank,
           CASE
             WHEN LOWER(properties->>'name') = $1 THEN 3
             WHEN LOWER(properties->>'name') LIKE $1 || '%' THEN 2
             WHEN LOWER(properties->>'name') LIKE '%' || $1 || '%' THEN 1
             ELSE 0
           END AS name_score,
           CASE
             WHEN type = 'skiArea' THEN 3
             WHEN type = 'lift' THEN 2
             WHEN type = 'run' THEN 1
             ELSE 0
           END AS type_score,
           0 AS boundary_bonus
         FROM features
         WHERE searchable_text ILIKE '%' || $1 || '%'
           AND type != 'spot'
           AND NOT EXISTS (SELECT 1 FROM primary_results p WHERE p.id = features.id)
       ),
       combined_results AS (
         SELECT * FROM primary_results
         UNION ALL
         SELECT * FROM fallback_results
       )
       SELECT id, type, geometry, properties
       FROM combined_results
       ORDER BY (type_score * 10 + name_score + boundary_bonus + rank) DESC
       LIMIT $3`,
      [searchLower, tsquery, limit]
    );
  };

  removeExceptImport = async (importID: string): Promise<void> => {
    await this.pool.query(
      "DELETE FROM features WHERE import_id != $1",
      [importID]
    );
  };

  upsert = async (feature: Feature, importID: string): Promise<void> => {
    const id = feature.properties.id;
    const searchableText = getSearchableText(feature);
    const rank = calculateRank(feature);

    await this.pool.query(
      `INSERT INTO features (id, type, searchable_text, searchable_text_ts, geometry, properties, rank, import_id)
       VALUES ($1, $2, $3, to_tsvector('simple', $3), $4, $5, $6, $7)
       ON CONFLICT (id)
       DO UPDATE SET
         type = EXCLUDED.type,
         searchable_text = EXCLUDED.searchable_text,
         searchable_text_ts = EXCLUDED.searchable_text_ts,
         geometry = EXCLUDED.geometry,
         properties = EXCLUDED.properties,
         rank = EXCLUDED.rank,
         import_id = EXCLUDED.import_id,
         updated_at = NOW()`,
      [
        id,
        feature.properties.type,
        searchableText,
        JSON.stringify(feature.geometry),
        JSON.stringify(feature.properties),
        rank,
        importID
      ]
    );

    await this.pool.query(
      'DELETE FROM feature_sources WHERE feature_id = $1',
      [id]
    );
    const sources = (feature.properties as any).sources ?? [];
    if (sources.length > 0) {
      const placeholders = sources
        .map((_: unknown, i: number) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
        .join(', ');
      const params: unknown[] = [
        id,
        ...sources.flatMap((s: { type: string; id: unknown }) => [s.type, String(s.id)]),
      ];
      await this.pool.query(
        `INSERT INTO feature_sources (feature_id, source_type, source_id) VALUES ${placeholders}
         ON CONFLICT (feature_id, source_type, source_id) DO NOTHING`,
        params
      );
    }
  };
}

function getSearchableText(feature: Feature | SkiAreaSummaryFeature): string {
  let searchableText: (string | undefined | null)[] = [];

  if ('name' in feature.properties) {
    searchableText.push(feature.properties.name);
  }

  if ('places' in feature.properties) {
    feature.properties.places.forEach(place => {
      searchableText.push(place.localized.en.locality);
    });
  }

  if ('skiAreas' in feature.properties) {
    feature.properties.skiAreas.forEach(skiArea => {
      searchableText.push(getSearchableText(skiArea));
    });
  }

  return [...new Set(searchableText.filter((v): v is string => !!v))].join(' ');
}

function rowToFeature(row: any): any {
  return {
    type: "Feature",
    properties: row.properties,
    geometry: row.geometry,
  };
}
