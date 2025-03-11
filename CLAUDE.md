# OpenSkiMap API - Dev Commands & Style Guide

## Build & Run Commands

- `npm run build` - Compile TypeScript
- `npm run watch` - Watch TypeScript files for changes
- `npm run start` - Start the server
- `npm run check-types` - Check TypeScript types
- `npm run import-data` - Import ski data from import/ directory
- `npm run drop-database` - Drop the database
- `npm run docker-debug` - Run in debug mode with Docker

## Code Style Guidelines

- **Naming**: PascalCase for classes/types/interfaces, camelCase for variables/functions
- **Imports**: Group by external modules then local modules with blank line between
- **Types**: Use strict TypeScript typing, avoid `any` when possible
- **Error Handling**: Use try/catch blocks with specific error types
- **Async Code**: Use async/await pattern consistently
- **Formatting**: 2-space indentation, no semicolons
- **Database Operations**: Use AQL template strings with parameterization
- **File Organization**: One class/component per file, named after its contents

## Architecture

- Express.js web server with TypeScript
- ArangoDB for data storage with arangojs as client
- GeoJSON as primary data format
- Repository pattern for database operations
