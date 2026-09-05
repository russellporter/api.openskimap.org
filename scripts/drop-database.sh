#!/bin/sh
if [ "$NODE_ENV" = "production" ]; then
  exec node dist/scripts/drop_database.js "$@"
else
  exec node src/scripts/drop_database.ts "$@"
fi
