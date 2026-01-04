#!/bin/sh
if [ "$NODE_ENV" = "production" ]; then
  exec node dist/scripts/import_data.js "$@"
else
  exec node -r ts-node/register src/scripts/import_data.ts "$@"
fi
