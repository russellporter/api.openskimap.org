import { LiftFeature, RunFeature, SkiAreaFeature } from "openskidata-format";
import streamToPromise from "stream-to-promise";
import { readGeoJSONFeatures } from "./GeoJSONReader";
import { Repository } from "./Repository";
import { andFinally } from "./StreamTransforms";

export class DataImporter {
  private repository: Repository;

  constructor(repository: Repository) {
    this.repository = repository;
  }

  import = async (geoJSONFiles: string[], importID: string): Promise<void> => {
    for (const file of geoJSONFiles) {
      await streamToPromise(
        readGeoJSONFeatures(file).pipe(
          andFinally(
            async (feature: RunFeature | LiftFeature | SkiAreaFeature) =>
              await this.repository.upsert(feature, importID)
          )
        )
      )
    }
  };

  purgeOldData = async (excludingImportID: string): Promise<void> => {
    return await this.repository.removeExceptImport(excludingImportID);
  };
}
