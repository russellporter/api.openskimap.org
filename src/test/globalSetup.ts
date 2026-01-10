import { v4 as uuid } from "uuid"
import { DataImporter } from '../DataImporter'
import getRepository from '../RepositoryFactory'
import { resetDatabase } from './helpers/database'

export default async function setup() {
  // Needs to be duplicated here as vitest doesnt apply env from config to globalSetup.
  const databaseName = "openskimap_test"

  console.log('Resetting test database...')
  await resetDatabase(databaseName)

  console.log('Initializing repository and schema...')
  const repository = await getRepository(databaseName)

  console.log('Loading fixtures...')
  const importer = new DataImporter(repository);
  await importer.import([
    'src/test/fixtures/ski_areas_test.geojson',
    'src/test/fixtures/lifts_test.geojson',
    'src/test/fixtures/runs_test.geojson'
  ], uuid())
  
  console.log('Database setup complete!')
}
