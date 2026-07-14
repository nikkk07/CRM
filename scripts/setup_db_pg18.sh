#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PSQL="/Library/PostgreSQL/18/bin/psql"

if [ -z "$PGPASSWORD" ]; then
    echo "ERROR: Set PGPASSWORD environment variable first:"
    echo "export PGPASSWORD='your_postgres_password'"
    echo "Then run: ./setup_db_pg18.sh"
    exit 1
fi

echo "Using PostgreSQL 18 at /Library/PostgreSQL/18"
echo ""

echo "Creating database..."
$PSQL -U postgres -h localhost -c "CREATE DATABASE crm_we_one;" 2>/dev/null || echo "Database already exists"

echo "Creating pgvector extension..."
$PSQL -U postgres -h localhost -d crm_we_one -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "Running migrations..."
$PSQL -U postgres -h localhost -d crm_we_one < "$PROJECT_DIR/backend/migrations/001_init_schema.sql"

echo "Creating default owner account (phone: +919999999999, password: admin123)..."
pip3 install passlib bcrypt 2>/dev/null || true
HASH=$(python3 -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('admin123'))")

$PSQL -U postgres -h localhost -d crm_we_one <<EOF
INSERT INTO employee (name, phone, email, role, permissions, password_hash)
VALUES ('System Admin', '+919999999999', 'admin@weone.aviation', 'owner', '{}'::jsonb, '$HASH')
ON CONFLICT (phone) DO NOTHING;
EOF

echo ""
echo "✅ PostgreSQL setup complete!"
echo "Login with: +919999999999 / admin123"
echo ""
echo "Update DATABASE_URL in backend to:"
echo "export DATABASE_URL='postgresql://postgres:$PGPASSWORD@localhost/crm_we_one'"
