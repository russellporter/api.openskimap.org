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

  import = async (geoJSONFiles: string[]): Promise<void> => {
    await Promise.all(
      geoJSONFiles.map(file => {
        streamToPromise(
          readGeoJSONFeatures(file).pipe(
            // TODO: Add parallelism
            andFinally(
              async (feature: RunFeature | LiftFeature | SkiAreaFeature) =>
                await this.repository.upsert(feature)
            )
          )
        );
      })
    );
  };

  purgeOldData() {
    // TODO: Implement
  }
}
