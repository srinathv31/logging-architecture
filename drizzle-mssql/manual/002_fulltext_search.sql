-- ===========================================
-- Full-Text Search Setup
-- Run this script to enable CONTAINS() search on event_logs.summary
-- Requires SQL Server Full-Text Search feature to be installed
-- ===========================================

-- Create unique index for full-text (required by MSSQL)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_fulltext_key' AND object_id = OBJECT_ID('event_logs'))
    CREATE UNIQUE INDEX [ix_event_logs_fulltext_key] ON [event_logs] ([event_log_id]);

-- Create catalog
IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'EventLogsCatalog')
    CREATE FULLTEXT CATALOG EventLogsCatalog AS DEFAULT;

-- Create full-text index on summary column
IF NOT EXISTS (SELECT 1 FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('event_logs'))
    CREATE FULLTEXT INDEX ON [event_logs] ([summary])
    KEY INDEX [ix_event_logs_fulltext_key]
    ON EventLogsCatalog
    WITH CHANGE_TRACKING AUTO;
