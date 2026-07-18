#!/bin/bash
set -e

echo "This script will temporarily allow passwordless access to reset the postgres password."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

PG_HBA="/Library/PostgreSQL/18/data/pg_hba.conf"
PG_HBA_BACKUP="/tmp/pg_hba.conf.backup"

echo "Backing up pg_hba.conf..."
sudo cp "$PG_HBA" "$PG_HBA_BACKUP"

echo "Setting temporary trust authentication..."
sudo sed -i '' 's/scram-sha-256/trust/g' "$PG_HBA"

echo "Reloading PostgreSQL..."
sudo su - postgres -c "/Library/PostgreSQL/18/bin/pg_ctl reload -D /Library/PostgreSQL/18/data"

sleep 2

echo ""
echo "Enter new password for postgres user:"
read -s NEW_PASSWORD

echo "Resetting password..."
/Library/PostgreSQL/18/bin/psql -U postgres -h localhost -c "ALTER USER postgres WITH PASSWORD '$NEW_PASSWORD';"

echo "Restoring pg_hba.conf..."
sudo cp "$PG_HBA_BACKUP" "$PG_HBA"

echo "Reloading PostgreSQL..."
sudo su - postgres -c "/Library/PostgreSQL/18/bin/pg_ctl reload -D /Library/PostgreSQL/18/data"

echo ""
echo "✅ Password reset complete!"
echo "Now run: export PGPASSWORD='$NEW_PASSWORD' && ./setup_db_pg18.sh"
