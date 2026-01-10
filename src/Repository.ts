import {
  FeatureType,
  LiftFeature,
  RunFeature,
  SkiAreaFeature,
  SkiAreaSummaryFeature
} from "openskidata-format";
import { Pool } from "pg";
import { calculateRank } from "./RankCalculator";

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

  get = async (
    id: string
  ): Promise<RunFeature | LiftFeature | SkiAreaFeature> => {
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

  search = async (
    text: string,
    limit: number
  ): Promise<(RunFeature | LiftFeature | SkiAreaFeature)[]> => {
    const searchLower = text.toLowerCase();

    // Prepare tsquery with prefix matching for all tokens
    // "garmisch classic" → "garmisch:* & classic:*"
    const tokens = searchLower.split(/\s+/).filter(t => t.length > 0);
    const tsquery = tokens.map(t => `${t}:*`).join(' & ');

    const result = await this.pool.query(
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
       ),
       fallback_results AS (
         -- Fallback: LIKE search (substring matching anywhere)
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
         WHERE LOWER(searchable_text) LIKE '%' || $1 || '%'
           AND id NOT IN (SELECT id FROM primary_results)
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

    return result.rows.map(rowToFeature);
  };

  removeExceptImport = async (importID: string): Promise<void> => {
    await this.pool.query(
      "DELETE FROM features WHERE import_id != $1",
      [importID]
    );
  };

  upsert = async (
    feature: LiftFeature | RunFeature | SkiAreaFeature,
    importID: string
  ): Promise<void> => {
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
  };
}

function getSearchableText(feature: RunFeature | LiftFeature | SkiAreaFeature | SkiAreaSummaryFeature): string {
  let searchableText: (string | undefined | null)[] = [feature.properties.name];

  if ('places' in feature.properties) {
    feature.properties.places.forEach(place => {
      searchableText.push(place.localized.en.locality);
    });
  }

  if (feature.properties.type == FeatureType.Lift || feature.properties.type == FeatureType.Run) {
    feature.properties.skiAreas.forEach(skiArea => {
      searchableText.push(getSearchableText(skiArea))
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
