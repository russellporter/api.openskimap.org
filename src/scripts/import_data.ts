import uuid from "uuid";
import { DataImporter } from "../DataImporter";
import getRepository from "../RepositoryFactory";

(async () => {
  try {
    const repository = await getRepository();
    const importer = new DataImporter(repository);
    const files = process.argv.slice(2);
    const importID = uuid();

    if (files.length === 0) {
      console.log("No files to import. Provide files to import as arguments.");
    } else {
      await importer.import(files, importID);
    }

    await importer.purgeOldData(importID);
  } catch (e) {
    console.error("Failed importing data", e);
    process.exit(1);
  }
})();
