#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Please enter your PostgreSQL 18 postgres password:"
read -s PG_PASS
echo ""

export PGPASSWORD="$PG_PASS"

PSQL="/Library/PostgreSQL/18/bin/psql"

echo "Testing connection..."
if ! $PSQL -U postgres -h localhost -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Connection failed. Wrong password or PostgreSQL not running."
    exit 1
fi

echo "✅ Connection successful!"
echo ""

echo "Creating database..."
$PSQL -U postgres -h localhost -d postgres -c "CREATE DATABASE crm_we_one;" 2>/dev/null || echo "Database already exists"

echo "Creating pgvector extension..."
$PSQL -U postgres -h localhost -d crm_we_one -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "Running migrations..."
$PSQL -U postgres -h localhost -d crm_we_one < "$PROJECT_DIR/backend/migrations/001_init_schema.sql"

echo "Installing Python dependencies..."
pip3 install 'passlib[bcrypt]' 2>/dev/null || pip3 install --user 'passlib[bcrypt]'

echo "Creating default owner account (phone: +919999999999, password: admin123)..."
HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode('utf-8'))")

$PSQL -U postgres -h localhost -d crm_we_one <<EOF
INSERT INTO employee (name, phone, email, role, permissions, password_hash)
VALUES ('System Admin', '+919999999999', 'admin@weone.aviation', 'owner', '{}'::jsonb, '$HASH')
ON CONFLICT (phone) DO NOTHING;
EOF

echo ""
echo "✅ Database setup complete!"
echo "Login credentials: +919999999999 / admin123"
echo ""
echo "Set this in your backend environment:"
echo "export DATABASE_URL='postgresql://postgres:$PG_PASS@localhost/crm_we_one'"
