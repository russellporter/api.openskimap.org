import { Pool } from 'pg'
import * as Config from '../../Config'

function createAdminPool(): Pool {
  return new Pool({
    host: Config.postgres.host,
    user: Config.postgres.user,
    password: Config.postgres.password,
    database: 'postgres',
    port: Config.postgres.port,
  })
}

async function executeWithAdminPool(fn: (pool: Pool) => Promise<void>): Promise<void> {
  const pool = createAdminPool()
  try {
    await fn(pool)
  } finally {
    await pool.end()
  }
}

export async function resetDatabase(name: String): Promise<void> {
  await executeWithAdminPool(async (pool) => {
    await pool.query(`DROP DATABASE IF EXISTS ${name}`)
    await pool.query(`CREATE DATABASE ${name}`)
  })
}