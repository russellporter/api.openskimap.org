import { v4 as uuid } from "uuid";
import { DataImporter } from "../DataImporter";
import getRepository from "../RepositoryFactory";

const SKI_PASSES_FLAG = "--ski-passes=";

(async () => {
  try {
    const repository = await getRepository();
    const importer = new DataImporter(repository);
    const args = process.argv.slice(2);
    // Ski passes are not GeoJSON features, so they are named by their own flag rather than being
    // mixed in with the feature files.
    const skiPassFiles = args
      .filter((arg) => arg.startsWith(SKI_PASSES_FLAG))
      .map((arg) => arg.slice(SKI_PASSES_FLAG.length));
    const files = args.filter((arg) => !arg.startsWith("--"));
    const importID = uuid();

    if (files.length === 0 && skiPassFiles.length === 0) {
      console.log("No files to import. Provide files to import as arguments.");
    } else {
      await importer.import(files, importID);
      for (const file of skiPassFiles) {
        await importer.importSkiPasses(file, importID);
      }
    }

    await importer.purgeOldData(importID);
  } catch (e) {
    console.error("Failed importing data", e);
    process.exit(1);
  }
})();
