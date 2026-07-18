#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL not found. Installing..."
    brew install postgresql@16
fi

echo "Checking if PostgreSQL is running..."
if ! pgrep -f postgres > /dev/null; then
    echo "Starting PostgreSQL..."
    brew services restart postgresql@16
    sleep 3
fi

echo "Creating database..."
psql postgres -c "CREATE DATABASE crm_we_one;" 2>/dev/null || echo "Database already exists"

echo "Installing pgvector extension..."
brew list pgvector &>/dev/null || brew install pgvector

echo "Running migrations..."
psql crm_we_one < "$PROJECT_DIR/backend/migrations/001_init_schema.sql"

echo "Creating default owner account (phone: +919999999999, password: admin123)..."
python3 -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('admin123'))" > /tmp/hash.txt
HASH=$(cat /tmp/hash.txt)
rm /tmp/hash.txt

psql crm_we_one <<EOF
INSERT INTO employee (name, phone, email, role, permissions, password_hash)
VALUES ('System Admin', '+919999999999', 'admin@weone.aviation', 'owner', '{}'::jsonb, '$HASH')
ON CONFLICT (phone) DO NOTHING;
EOF

echo "PostgreSQL setup complete!"
echo "Login with: +919999999999 / admin123"
