import { v4 as uuid } from 'uuid'
import { DataImporter } from '../../DataImporter'
import { Repository } from '../../Repository'
import path from 'path'

export async function loadTestFixtures(repository: Repository): Promise<void> {
  const importer = new DataImporter(repository)
  const importID = uuid()

  const fixtureFiles = ['ski_areas_test', 'lifts_test', 'runs_test']
  const fixtureDir = path.join(__dirname, '../fixtures')
  const files = fixtureFiles.map(name => path.join(fixtureDir, `${name}.geojson`))

  await importer.import(files, importID)
}
