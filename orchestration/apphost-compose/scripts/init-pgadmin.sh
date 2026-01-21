#!/bin/sh
# =====================================================
# TC Agro Solutions - PgAdmin Initialization Script
# =====================================================
# Purpose: Clean PgAdmin state on startup to force config reload
# Executed automatically by Docker Compose
# =====================================================

echo "🔧 PgAdmin initialization starting..."

# Wait for PgAdmin to be ready
sleep 2

# Clean old configuration if it exists
if [ -f /var/lib/pgadmin/pgadmin4.db ]; then
    echo "⚠️  Found existing pgadmin4.db - cleaning old configuration..."
    rm -f /var/lib/pgadmin/pgadmin4.db
    echo "✅ Old configuration removed"
fi

# Ensure servers.json is in the correct location for first-time import
if [ -f /pgadmin4/servers.json ]; then
    echo "📋 Copying server configuration for import..."
    cp /pgadmin4/servers.json /tmp/servers_import.json
    echo "✅ Configuration ready for import"
fi

echo "✅ PgAdmin initialization complete - starting application..."

# Execute original entrypoint
exec /entrypoint.sh
