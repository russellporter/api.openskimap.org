import { readFile } from "node:fs/promises";
import type { SkiPassCatalog } from "openskidata-format";

import { readGeoJSONFeatures } from "./GeoJSONReader.ts";
import type { Repository } from "./Repository.ts";
import type { Feature, SkiPassFeature } from "./types.ts";

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

  /**
   * Imports the actual passes from the non-GeoJSON `ski_passes.json` catalogue. Brands are
   * presentation metadata and are deliberately not stored or searched.
   *
   * This must share the `importID` of the features imported alongside it, since anything from an
   * earlier import is purged once the import finishes.
   */
  importSkiPasses = async (file: string, importID: string): Promise<void> => {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.brands) ||
      !Array.isArray(parsed.passes)
    ) {
      throw new Error(`Expected ${file} to hold a ski pass catalog.`);
    }

    for (const skiPass of (parsed as SkiPassCatalog).passes) {
      if (skiPass.type !== "skiPass") {
        throw new Error(
          `Expected ${file} to hold only ski passes, found "${skiPass.type}".`,
        );
      }
      const feature: SkiPassFeature = {
        type: "Feature",
        geometry: null,
        properties: skiPass,
      };
      await this.repository.upsert(feature, importID);
    }
  };

  purgeOldData = async (excludingImportID: string): Promise<void> => {
    return await this.repository.removeExceptImport(excludingImportID);
  };
}
