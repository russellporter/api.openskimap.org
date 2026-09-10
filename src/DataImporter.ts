import { readGeoJSONFeatures } from "./GeoJSONReader.ts";
import type { Repository } from "./Repository.ts";
import type { Feature } from "./types.ts";

export class DataImporter {
  private repository: Repository;

  constructor(repository: Repository) {
    this.repository = repository;
  }

  import = async (geoJSONFiles: string[], importID: string): Promise<void> => {
    for (const file of geoJSONFiles) {
      for await (const feature of readGeoJSONFeatures(file)) {
        await this.repository.upsert(feature, importID);
      }
    }
  };

  purgeOldData = async (excludingImportID: string): Promise<void> => {
    return await this.repository.removeExceptImport(excludingImportID);
  };
}
