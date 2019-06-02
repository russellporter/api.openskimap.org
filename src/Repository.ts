import * as arangojs from "arangojs";
import { LiftFeature, RunFeature, SkiAreaFeature } from "openskidata-format";
import * as Config from "./Config";

export class Repository {
  private database: arangojs.Database;
  private collection: arangojs.DocumentCollection;

  constructor(database: arangojs.Database) {
    this.database = database;
    this.collection = database.collection(Config.arangodb.featuresCollection);
  }
  upsert = async (
    feature: LiftFeature | RunFeature | SkiAreaFeature
  ): Promise<void> => {
    await this.upsertData(
      feature.properties.id,
      feature,
      [feature.properties.name].filter((v): v is string => v !== null)
    );
  };

  private upsertData = async (
    id: string,
    feature: RunFeature | LiftFeature | SkiAreaFeature,
    searchableText: string[]
  ): Promise<void> => {
    await this.database.query(arangojs.aql`
      UPSERT { _key: ${id} }
      INSERT 
        {
          _key: ${id},
          type: ${feature.properties.type},
          searchableText: ${searchableText},
          geometry: ${feature.geometry},
          feature: ${feature},
          modificationDate: DATE_NOW()
        } 
      UPDATE
        {
          _key: ${id},
          type: ${feature.properties.type},
          searchableText: ${searchableText},
          geometry: ${feature.geometry},
          feature: ${feature},
          modificationDate: DATE_NOW()
        } 
      IN ${this.collection}
      `);
  };
}
