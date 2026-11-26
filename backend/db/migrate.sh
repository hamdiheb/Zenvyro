#!/bin/sh
set -eu

MIGRATIONS_DIR=/migrations

# Tracking table: one row per applied migration file
psql -X -q -v ON_ERROR_STOP=1 -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

for file in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$file" ] || continue
  name=$(basename "$file")

  already=$(psql -X -tA -c "SELECT 1 FROM schema_migrations WHERE filename = '$name';")
  if [ "$already" = "1" ]; then
    echo "skip   $name"
    continue
  fi

  echo "apply  $name"
  # Run the file and record it in one transaction: both succeed or neither does
  { echo "BEGIN;"; cat "$file"; echo "INSERT INTO schema_migrations (filename) VALUES ('$name');"; echo "COMMIT;"; } \
    | psql -X -q -v ON_ERROR_STOP=1
done

echo "migrations up to date"