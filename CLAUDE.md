# OpenSkiMap API - Dev Commands & Style Guide

## Development Workflow

All commands should be run inside the Docker container.

### Useful commands

- `docker compose up` - Start services (app + database) in development mode (with file watching)
- `docker compose exec app npm run build` - Compile TypeScript
- `docker compose exec app npm run check-types` - Check TypeScript types
- `docker compose exec app npm run test` - Run tests
- `docker compose exec app npm run import-data import/ski_areas.geojson` - Import ski data
- `docker compose exec app npm run drop-database` - Drop the database
- `docker compose run --rm app npm install` - Install dependencies
- `docker compose exec app sh` - Get a shell inside the app container, then run commands directly

## Code Style Guidelines

- **Naming**: PascalCase for classes/types/interfaces, camelCase for variables/functions
- **Imports**: Group by external modules then local modules with blank line between
- **Types**: Use strict TypeScript typing, avoid `any` when possible
- **Error Handling**: Use try/catch blocks with specific error types
- **Async Code**: Use async/await pattern consistently
- **Formatting**: 2-space indentation, no semicolons
- **Database Operations**: Use parameterized SQL queries with pg.Pool
- **File Organization**: One class/component per file, named after its contents

## Architecture

- Express.js web server with TypeScript
- PostgreSQL for data storage with pg (node-postgres) client
- GeoJSON stored as JSONB in PostgreSQL
- Repository pattern for database operations
- pg_trgm extension for fuzzy text search
