#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping PostgreSQL 18..."
sudo launchctl unload /Library/LaunchDaemons/com.edb.launchd.postgresql-18.plist 2>/dev/null || true

echo "Starting Homebrew PostgreSQL@16..."
brew services start postgresql@16
sleep 3

echo "Installing pgvector..."
brew list pgvector &>/dev/null || brew install pgvector

echo "Creating database..."
/opt/homebrew/bin/createdb crm_we_one 2>/dev/null || echo "Database already exists"

echo "Running migrations..."
/opt/homebrew/bin/psql crm_we_one < "$PROJECT_DIR/backend/migrations/001_init_schema.sql"

echo "Installing Python dependencies..."
pip3 install passlib bcrypt 2>/dev/null || true

echo "Creating default owner account (phone: +919999999999, password: admin123)..."
HASH=$(python3 -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('admin123'))")

/opt/homebrew/bin/psql crm_we_one <<EOF
INSERT INTO employee (name, phone, email, role, permissions, password_hash)
VALUES ('System Admin', '+919999999999', 'admin@weone.aviation', 'owner', '{}'::jsonb, '$HASH')
ON CONFLICT (phone) DO NOTHING;
EOF

echo ""
echo "✅ Database setup complete!"
echo "Login with: +919999999999 / admin123"
echo ""
echo "DATABASE_URL: postgresql://localhost/crm_we_one"
