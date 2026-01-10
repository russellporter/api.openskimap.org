import { Pool } from 'pg'
import * as Config from '../../Config'

export async function createTestDatabase(): Promise<void> {
  const pool = new Pool({
    host: Config.postgres.host,
    user: Config.postgres.user,
    password: Config.postgres.password,
    database: 'postgres',
    port: Config.postgres.port,
  })

  try {
    await pool.query(`DROP DATABASE IF EXISTS ${Config.postgres.database}`)
    await pool.query(`CREATE DATABASE ${Config.postgres.database}`)
  } finally {
    await pool.end()
  }
}

export async function dropTestDatabase(): Promise<void> {
  const pool = new Pool({
    host: Config.postgres.host,
    user: Config.postgres.user,
    password: Config.postgres.password,
    database: 'postgres',
    port: Config.postgres.port,
  })

  try {
    await pool.query(`DROP DATABASE IF EXISTS ${Config.postgres.database}`)
  } finally {
    await pool.end()
  }
}
