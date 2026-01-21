-- =====================================================
-- TC Agro Solutions - PostgreSQL Initialization Script
-- =====================================================
-- Purpose: Ensure correct database setup on container start
-- Executed automatically by Docker Compose
-- =====================================================

-- Drop old "agro" database if it exists
DROP DATABASE IF EXISTS agro;

-- Create main database if it doesn't exist
SELECT 'CREATE DATABASE "tc-agro-identity-db"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tc-agro-identity-db')\gexec

-- Enable TimescaleDB extension
\c tc-agro-identity-db
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Log completion
\echo '✅ PostgreSQL initialization complete: tc-agro-identity-db ready'
