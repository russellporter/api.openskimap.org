#!/bin/sh
if [ "$NODE_ENV" = "production" ]; then
  exec node dist/scripts/import_data.js "$@"
else
  exec node src/scripts/import_data.ts "$@"
fi
