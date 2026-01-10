#!/bin/sh
set -e

# Set test environment
export POSTGRES_DB=openskimap_test

# Create test database
echo "Creating test database..."
node -e "
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
  });
  try {
    await pool.query('DROP DATABASE IF EXISTS ' + process.env.POSTGRES_DB);
    await pool.query('CREATE DATABASE ' + process.env.POSTGRES_DB);
    console.log('Test database created');
  } finally {
    await pool.end();
  }
})();
"

# Import test data
echo "Importing test data..."
npm run import-data src/test/fixtures/ski_areas_test.geojson src/test/fixtures/lifts_test.geojson src/test/fixtures/runs_test.geojson

# Run tests
echo "Running tests..."
npm test
