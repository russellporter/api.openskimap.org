import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { DataImporter } from '../../DataImporter.ts'
import type { Repository } from '../../Repository.ts'

export async function loadTestFixtures(repository: Repository): Promise<void> {
  const importer = new DataImporter(repository)
  const importID = randomUUID()

  const fixtureFiles = ['ski_areas_test', 'lifts_test', 'runs_test']
  const fixtureDir = path.join(import.meta.dirname, '../fixtures')
  const files = fixtureFiles.map(name => path.join(fixtureDir, `${name}.geojson`))

  await importer.import(files, importID)
}
