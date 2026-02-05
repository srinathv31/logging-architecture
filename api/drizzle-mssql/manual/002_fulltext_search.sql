-- ===========================================
-- Full-Text Search Setup
-- Run this script to enable CONTAINS() search on event_log.summary
-- Requires SQL Server Full-Text Search feature to be installed
-- ===========================================

-- Create unique index for full-text (required by MSSQL)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_fulltext_key' AND object_id = OBJECT_ID('event_log'))
    CREATE UNIQUE INDEX [ix_event_log_fulltext_key] ON [event_log] ([event_log_id]);

-- Create catalog
IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'EventLogCatalog')
    CREATE FULLTEXT CATALOG EventLogCatalog AS DEFAULT;

-- Create full-text index on summary column
IF NOT EXISTS (SELECT 1 FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('event_log'))
    CREATE FULLTEXT INDEX ON [event_log] ([summary])
    KEY INDEX [ix_event_log_fulltext_key]
    ON EventLogCatalog
    WITH CHANGE_TRACKING AUTO;
