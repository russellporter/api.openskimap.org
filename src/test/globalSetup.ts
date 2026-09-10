import { randomUUID } from "node:crypto"

import { DataImporter } from '../DataImporter.ts'
import getRepository from '../RepositoryFactory.ts'
import { resetDatabase } from './helpers/database.ts'

export default async function setup() {
  // Needs to be duplicated here as vitest doesnt apply env from config to globalSetup.
  const databaseName = "openskimap_test"

  console.log('Resetting test database...')
  await resetDatabase(databaseName)

  console.log('Initializing repository and schema...')
  const repository = await getRepository(databaseName)

  console.log('Loading fixtures...')
  const importer = new DataImporter(repository);
  const importID = randomUUID();
  await importer.import([
    'src/test/fixtures/ski_areas_test.geojson',
    'src/test/fixtures/lifts_test.geojson',
    'src/test/fixtures/runs_test.geojson'
  ], importID)
  
  console.log('Database setup complete!')
}
