import { DataImporter } from "../DataImporter";
import getRepository from "../RepositoryFactory";

(async () => {
  try {
    const repository = await getRepository();
    const importer = new DataImporter(repository);
    const files = process.argv.slice(2);

    if (files.length === 0) {
      console.log("No files to import. Provide files to import as arguments.");
    } else {
      await importer.import(files);
    }
  } catch (e) {
    console.error("Failed importing data", e);
    process.exit(1);
  }
})();
