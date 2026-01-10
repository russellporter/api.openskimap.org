import { v4 as uuid } from 'uuid'
import { DataImporter } from '../../DataImporter'
import { Repository } from '../../Repository'
import path from 'path'

export async function loadTestFixtures(repository: Repository): Promise<void> {
  const importer = new DataImporter(repository)
  const importID = uuid()

  const fixtureDir = path.join(__dirname, '../fixtures')
  const files = [
    path.join(fixtureDir, 'ski_areas_test.geojson'),
    path.join(fixtureDir, 'lifts_test.geojson'),
    path.join(fixtureDir, 'runs_test.geojson'),
  ]

  await importer.import(files, importID)
}
