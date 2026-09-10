import { randomUUID } from "node:crypto";

import { DataImporter } from "../DataImporter.ts";
import getRepository from "../RepositoryFactory.ts";

(async () => {
  try {
    const repository = await getRepository();
    const importer = new DataImporter(repository);
    const args = process.argv.slice(2);
    const files = args.filter((arg) => !arg.startsWith("--"));
    const importID = randomUUID();

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
