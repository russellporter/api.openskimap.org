import { Pool } from 'pg'
import { describe, expect, it } from 'vitest'

import * as Config from '../../Config.ts'
import getRepository from '../../RepositoryFactory.ts'
import { resetDatabase } from '../helpers/database.ts'

const DATABASE_NAME = 'openskimap_backfill_test'

function createPool(database: string): Pool {
  return new Pool({
    host: Config.postgres.host,
    user: Config.postgres.user,
    password: Config.postgres.password,
    database,
    port: Config.postgres.port,
  })
}

describe('bounding box backfill migration', () => {
  it('populates bounds for features stored before the columns existed', async () => {
    await resetDatabase(DATABASE_NAME)

    // First startup creates the schema and bounding box columns.
    await getRepository(DATABASE_NAME)

    // Simulate a row imported before the columns existed: geometry set, bounds null.
    const setupPool = createPool(DATABASE_NAME)
    try {
      await setupPool.query(
        `INSERT INTO features (id, type, searchable_text, geometry, properties, import_id)
         VALUES ($1, 'run', 'backfill test', $2, $3, gen_random_uuid())`,
        [
          'backfill-test',
          JSON.stringify({
            type: 'LineString',
            coordinates: [
              [11.0, 47.0, 500],
              [12.0, 48.0, 900],
            ],
          }),
          JSON.stringify({ type: 'run', id: 'backfill-test' }),
        ]
      )
    } finally {
      await setupPool.end()
    }

    // Re-initializing the repository triggers the backfill.
    await getRepository(DATABASE_NAME)

    const verifyPool = createPool(DATABASE_NAME)
    try {
      const result = await verifyPool.query(
        'SELECT min_lon, min_lat, max_lon, max_lat FROM features WHERE id = $1',
        ['backfill-test']
      )
      expect(result.rows[0]).toEqual({
        min_lon: 11.0,
        min_lat: 47.0,
        max_lon: 12.0,
        max_lat: 48.0,
      })
    } finally {
      await verifyPool.end()
    }
  })
})
