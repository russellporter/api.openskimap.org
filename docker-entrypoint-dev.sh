#!/bin/sh
set -e

echo "Installing dependencies..."
npm ci

echo "Dependencies installed, starting application..."
exec "$@"
