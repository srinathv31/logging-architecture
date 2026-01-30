-- ===========================================
-- Manual Index Migration
-- Run this script manually after Drizzle migrations
-- ===========================================

-- ===========================================
-- event_logs indexes
-- ===========================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_correlation_id' AND object_id = OBJECT_ID('event_logs'))
    CREATE INDEX [ix_event_logs_correlation_id] ON [event_logs] ([correlation_id], [event_timestamp]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_account_id' AND object_id = OBJECT_ID('event_logs'))
    CREATE INDEX [ix_event_logs_account_id] ON [event_logs] ([account_id])
    WHERE [account_id] IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_trace_id' AND object_id = OBJECT_ID('event_logs'))
    CREATE INDEX [ix_event_logs_trace_id] ON [event_logs] ([trace_id]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_process' AND object_id = OBJECT_ID('event_logs'))
    CREATE INDEX [ix_event_logs_process] ON [event_logs] ([process_name], [event_timestamp]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_timestamp' AND object_id = OBJECT_ID('event_logs'))
    CREATE INDEX [ix_event_logs_timestamp] ON [event_logs] ([event_timestamp]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_status' AND object_id = OBJECT_ID('event_logs'))
    CREATE INDEX [ix_event_logs_status] ON [event_logs] ([event_status], [event_timestamp])
    WHERE [event_status] = 'FAILURE';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_target_system' AND object_id = OBJECT_ID('event_logs'))
    CREATE INDEX [ix_event_logs_target_system] ON [event_logs] ([target_system], [event_timestamp]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_idempotency' AND object_id = OBJECT_ID('event_logs'))
    CREATE UNIQUE INDEX [ix_event_logs_idempotency] ON [event_logs] ([idempotency_key])
    WHERE [idempotency_key] IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_logs_batch_id' AND object_id = OBJECT_ID('event_logs'))
    CREATE INDEX [ix_event_logs_batch_id] ON [event_logs] ([batch_id], [correlation_id])
    WHERE [batch_id] IS NOT NULL;

-- ===========================================
-- correlation_links indexes
-- ===========================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_correlation_links_account_id' AND object_id = OBJECT_ID('correlation_links'))
    CREATE INDEX [ix_correlation_links_account_id] ON [correlation_links] ([account_id]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_correlation_links_application_id' AND object_id = OBJECT_ID('correlation_links'))
    CREATE INDEX [ix_correlation_links_application_id] ON [correlation_links] ([application_id])
    WHERE [application_id] IS NOT NULL;

-- ===========================================
-- process_definitions indexes
-- ===========================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_process_definitions_name' AND object_id = OBJECT_ID('process_definitions'))
    CREATE UNIQUE INDEX [ix_process_definitions_name] ON [process_definitions] ([process_name]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_process_definitions_owning_team' AND object_id = OBJECT_ID('process_definitions'))
    CREATE INDEX [ix_process_definitions_owning_team] ON [process_definitions] ([owning_team]);

-- ===========================================
-- account_timeline_summary indexes
-- ===========================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_account_timeline_summary_last_event' AND object_id = OBJECT_ID('account_timeline_summary'))
    CREATE INDEX [ix_account_timeline_summary_last_event] ON [account_timeline_summary] ([last_event_at]);
