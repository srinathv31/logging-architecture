-- ===========================================
-- Manual Index Migration
-- Run this script manually after Drizzle migrations
-- ===========================================

-- ===========================================
-- event_log indexes
-- ===========================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_correlation_id' AND object_id = OBJECT_ID('event_log'))
    CREATE INDEX [ix_event_log_correlation_id] ON [event_log] ([correlation_id], [event_timestamp]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_account_id' AND object_id = OBJECT_ID('event_log'))
    CREATE INDEX [ix_event_log_account_id] ON [event_log] ([account_id])
    WHERE [account_id] IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_trace_id' AND object_id = OBJECT_ID('event_log'))
    CREATE INDEX [ix_event_log_trace_id] ON [event_log] ([trace_id]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_process' AND object_id = OBJECT_ID('event_log'))
    CREATE INDEX [ix_event_log_process] ON [event_log] ([process_name], [event_timestamp]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_timestamp' AND object_id = OBJECT_ID('event_log'))
    CREATE INDEX [ix_event_log_timestamp] ON [event_log] ([event_timestamp]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_status' AND object_id = OBJECT_ID('event_log'))
    CREATE INDEX [ix_event_log_status] ON [event_log] ([event_status], [event_timestamp])
    WHERE [event_status] = 'FAILURE';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_target_system' AND object_id = OBJECT_ID('event_log'))
    CREATE INDEX [ix_event_log_target_system] ON [event_log] ([target_system], [event_timestamp]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_idempotency' AND object_id = OBJECT_ID('event_log'))
    CREATE UNIQUE INDEX [ix_event_log_idempotency] ON [event_log] ([idempotency_key])
    WHERE [idempotency_key] IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_log_batch_id' AND object_id = OBJECT_ID('event_log'))
    CREATE INDEX [ix_event_log_batch_id] ON [event_log] ([batch_id], [correlation_id])
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
