import * as arangojs from "arangojs";
import {
  FeatureType,
  LiftFeature,
  RunFeature,
  SkiAreaFeature
} from "openskidata-format";
import * as Config from "./Config";

export class Repository {
  private database: arangojs.Database;
  private collection: arangojs.DocumentCollection;

  constructor(database: arangojs.Database) {
    this.database = database;
    this.collection = database.collection(Config.arangodb.featuresCollection);
  }

  get = async (
    id: string
  ): Promise<RunFeature | LiftFeature | SkiAreaFeature | null> => {
    const document = await this.collection.document({ _key: id });

    return {
      type: "Feature",
      properties: document.properties,
      geometry: document.geometry
    };
  };

  search = async (
    text: string,
    type: FeatureType,
    limit: number
  ): Promise<(RunFeature | LiftFeature | SkiAreaFeature)[]> => {
    const cursor = await this.database.query(arangojs.aql`
    FOR feature IN FULLTEXT(${this.collection}, "searchableText", ${text})
    FILTER feature.type == ${type}
    LIMIT ${limit}
    RETURN feature
    `);
    return await cursor
      .all()
      .then((results: any[]) => results.map(r => r.feature));
  };

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
          properties: ${feature.properties},
          modificationDate: DATE_NOW()
        } 
      UPDATE
        {
          _key: ${id},
          type: ${feature.properties.type},
          searchableText: ${searchableText},
          geometry: ${feature.geometry},
          properties: ${feature.properties},
          modificationDate: DATE_NOW()
        } 
      IN ${this.collection}
      `);
  };
}
