#!/bin/bash
set -e

echo "Installing pgvector for PostgreSQL 18..."
echo ""

cd /tmp

echo "Cloning pgvector repository..."
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git pgvector-build 2>/dev/null || (cd pgvector-build && git pull)

cd pgvector-build

echo "Building pgvector..."
export PG_CONFIG=/Library/PostgreSQL/18/bin/pg_config
export SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk
make clean
make

echo "Installing pgvector (requires sudo)..."
sudo make install

cd /tmp
rm -rf pgvector-build

echo ""
echo "✅ pgvector installed successfully!"
echo "Now run: ./setup_with_pg18_simple.sh"
