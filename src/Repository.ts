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
    limit: number
  ): Promise<(RunFeature | LiftFeature | SkiAreaFeature)[]> => {
    const query = arangojs.aql`
    FOR feature IN ${this.collection}
    OPTIONS { indexHint: "textSearch_v2", forceIndexHint: true }
    FILTER TOKENS(${text}, "en_edge_ngram_v2") ALL == feature.searchableText 
    LET nameScore = LOWER(feature.properties.name) == LOWER(${text}) ? 3 :
                    STARTS_WITH(LOWER(feature.properties.name), LOWER(${text})) ? 2 :
                    CONTAINS(LOWER(feature.properties.name), LOWER(${text})) ? 1 : 0
    LET typeScore = feature.type == "skiArea" ? 3 :
                   feature.type == "lift" ? 2 :
                   feature.type == "run" ? 1 : 0
    LET combinedScore = typeScore * 10 + nameScore
    SORT combinedScore DESC
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

  if ('places' in feature.properties) {
    feature.properties.places.forEach(place => {
      searchableText.push(place.localized.en.locality);
    });
  }

  if (feature.properties.type == FeatureType.Lift || feature.properties.type == FeatureType.Run) {
    feature.properties.skiAreas.forEach(skiArea => {
      searchableText.push(...getSearchableText(skiArea))  
    });
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
