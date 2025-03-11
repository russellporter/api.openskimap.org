import * as arangojs from "arangojs";
import * as arangojsCollection from "arangojs/collection";
import {
  FeatureType,
  LiftFeature,
  RunFeature,
  SkiAreaFeature,
  SkiAreaSummaryFeature
} from "openskidata-format";
import * as Config from "./Config";

export class Repository {
  private database: arangojs.Database;
  private collection: arangojsCollection.DocumentCollection<any, any>;

  constructor(database: arangojs.Database) {
    this.database = database;
    this.collection = database.collection(Config.arangodb.featuresCollection);
  }

  has = async (id: string): Promise<boolean> => {
    return await this.collection.documentExists({ _key: id });
  };

  get = async (
    id: string
  ): Promise<RunFeature | LiftFeature | SkiAreaFeature> => {
    const document = await this.collection.document({ _key: id });

    return documentToFeature(document);
  };

  search = async (
    text: string,
    type: FeatureType,
    limit: number
  ): Promise<(RunFeature | LiftFeature | SkiAreaFeature)[]> => {
    const query = arangojs.aql`
    FOR feature IN ${this.collection}
    OPTIONS { indexHint: "textSearch_v2", forceIndexHint: true }
    FILTER TOKENS(${text}, "en_edge_ngram_v2") ALL == feature.searchableText 
    AND feature.type == ${type}
    LIMIT ${limit}
    RETURN feature
    `
    const cursor = await this.database.query(query);
    return await cursor
      .all()
      .then((results: any[]) => results.map(documentToFeature));
  };

  removeExceptImport = async (importID: string): Promise<void> => {
    await this.database.query(arangojs.aql`
    FOR feature IN ${this.collection}
    FILTER feature.importID != ${importID}
    REMOVE feature IN ${this.collection}
    OPTIONS { exclusive: true }
    `);
  };

  upsert = async (
    feature: LiftFeature | RunFeature | SkiAreaFeature,
    importID: string
  ): Promise<void> => {
    await this.upsertData(
      feature.properties.id,
      feature,
      importID
    );
  };

  private upsertData = async (
    id: string,
    feature: RunFeature | LiftFeature | SkiAreaFeature,
    importID: string
  ): Promise<void> => {
    const searchableText = getSearchableText(feature);
    await this.database.query(arangojs.aql`
      UPSERT { _key: ${id} }
      INSERT 
        {
          _key: ${id},
          type: ${feature.properties.type},
          searchableText: ${searchableText},
          geometry: ${feature.geometry},
          properties: ${feature.properties},
          importID: ${importID}
        } 
      UPDATE
        {
          _key: ${id},
          type: ${feature.properties.type},
          searchableText: ${searchableText},
          geometry: ${feature.geometry},
          properties: ${feature.properties},
          importID: ${importID}
        } 
      IN ${this.collection}
      OPTIONS { exclusive: true }
      `);
  };
}

function getSearchableText(feature: RunFeature | LiftFeature | SkiAreaFeature | SkiAreaSummaryFeature): string[] {
  let searchableText: (string | undefined | null)[] = [feature.properties.name];

  switch (feature.properties.type) {
    case FeatureType.Lift:
    case FeatureType.Run:
      feature.properties.skiAreas.forEach(skiArea => {
        searchableText.push(...getSearchableText(skiArea))  
      });
      break;
    case FeatureType.SkiArea:
      searchableText.push(feature.properties.location?.localized.en.locality);
      break;
  }
  
  return [...new Set(searchableText.filter((v): v is string => !!v))];
}

function documentToFeature(document: any): any {
  return {
    type: "Feature",
    properties: document.properties,
    geometry: document.geometry,
  };
}
