import * as arangojs from "arangojs";
import { LiftFeature, RunFeature, SkiAreaFeature } from "openskidata-format";

export class Repository {
  private database: arangojs.Database;

  constructor(database: arangojs.Database) {
    this.database = database;
  }
  upsert = (feature: LiftFeature | RunFeature | SkiAreaFeature) => {
    this.upsertData(
      feature.properties.id,
      feature,
      [feature.properties.name].filter((v): v is string => v !== null)
    );
  };

  private upsertData = (
    id: string,
    feature: RunFeature | LiftFeature | SkiAreaFeature,
    searchableText: string[]
  ) => {
    this.database.query(arangojs.aql`
      REPLACE { _key: ${id},
      type: ${feature.properties.type},
      searchableText: ${searchableText},
      feature: ${feature}},
      modificationDate: DATE_NOW()
      `);
  };
}
