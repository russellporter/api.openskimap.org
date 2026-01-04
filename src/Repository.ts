import { Pool } from "pg";
import {
  FeatureType,
  LiftFeature,
  RunFeature,
  SkiAreaFeature,
  SkiAreaSummaryFeature
} from "openskidata-format";

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

    const result = await this.pool.query(
      `WITH scored_features AS (
         SELECT
           id,
           type,
           geometry,
           properties,
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
         WHERE searchable_text % $1
       )
       SELECT id, type, geometry, properties, name_score, type_score
       FROM scored_features
       ORDER BY (type_score * 10 + name_score) DESC
       LIMIT $2`,
      [searchLower, limit]
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

    await this.pool.query(
      `INSERT INTO features (id, type, searchable_text, geometry, properties, import_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id)
       DO UPDATE SET
         type = EXCLUDED.type,
         searchable_text = EXCLUDED.searchable_text,
         geometry = EXCLUDED.geometry,
         properties = EXCLUDED.properties,
         import_id = EXCLUDED.import_id,
         updated_at = NOW()`,
      [
        id,
        feature.properties.type,
        searchableText,
        JSON.stringify(feature.geometry),
        JSON.stringify(feature.properties),
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
