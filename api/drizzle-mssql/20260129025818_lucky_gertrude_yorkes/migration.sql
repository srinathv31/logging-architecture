CREATE TABLE [event_logs] (
	[event_log_id] bigint IDENTITY(1, 1),
	[execution_id] varchar(36) NOT NULL CONSTRAINT [event_logs_execution_id_default] DEFAULT (LOWER(CONVERT(VARCHAR(36), NEWID()))),
	[correlation_id] varchar(200) NOT NULL,
	[account_id] varchar(64),
	[trace_id] varchar(200) NOT NULL,
	[span_id] varchar(64),
	[parent_span_id] varchar(64),
	[span_links] nvarchar(max),
	[batch_id] varchar(200),
	[application_id] varchar(200) NOT NULL,
	[target_system] varchar(200) NOT NULL,
	[originating_system] varchar(200) NOT NULL,
	[process_name] varchar(510) NOT NULL,
	[step_sequence] int,
	[step_name] varchar(510),
	[event_type] varchar(50) NOT NULL,
	[event_status] varchar(50) NOT NULL,
	[identifiers] nvarchar(max) NOT NULL,
	[summary] nvarchar(max) NOT NULL,
	[result] varchar(2048) NOT NULL,
	[metadata] nvarchar(max),
	[event_timestamp] datetime2(3) NOT NULL,
	[created_at] datetime2(3) NOT NULL CONSTRAINT [event_logs_created_at_default] DEFAULT (GETUTCDATE()),
	[execution_time_ms] int,
	[endpoint] varchar(510),
	[http_status_code] int,
	[http_method] varchar(20),
	[error_code] varchar(100),
	[error_message] varchar(2048),
	[request_payload] nvarchar(max),
	[response_payload] nvarchar(max),
	[idempotency_key] varchar(128),
	[is_deleted] bit NOT NULL CONSTRAINT [event_logs_is_deleted_default] DEFAULT ((0)),
	CONSTRAINT [event_logs_pkey] PRIMARY KEY([event_log_id]),
	CONSTRAINT [ck_event_logs_event_type] CHECK ([event_logs].[event_type] IN ('PROCESS_START', 'STEP', 'PROCESS_END', 'ERROR')),
	CONSTRAINT [ck_event_logs_event_status] CHECK ([event_logs].[event_status] IN ('SUCCESS', 'FAILURE', 'IN_PROGRESS', 'SKIPPED')),
	CONSTRAINT [ck_event_logs_http_method] CHECK ([event_logs].[http_method] IS NULL OR [event_logs].[http_method] IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS')),
	CONSTRAINT [ck_event_logs_span_links_json] CHECK ([event_logs].[span_links] IS NULL OR ISJSON([event_logs].[span_links]) = 1)
);
--> statement-breakpoint
CREATE TABLE [correlation_links] (
	[correlation_id] varchar(200),
	[account_id] varchar(64) NOT NULL,
	[application_id] varchar(100),
	[customer_id] varchar(100),
	[card_number_last4] varchar(4),
	[linked_at] datetime2(3) NOT NULL CONSTRAINT [correlation_links_linked_at_default] DEFAULT (GETUTCDATE()),
	CONSTRAINT [correlation_links_pkey] PRIMARY KEY([correlation_id])
);
--> statement-breakpoint
CREATE TABLE [process_definitions] (
	[process_id] int IDENTITY(1, 1),
	[process_name] varchar(510) NOT NULL,
	[display_name] varchar(510) NOT NULL,
	[description] nvarchar(max) NOT NULL,
	[owning_team] varchar(200) NOT NULL,
	[expected_steps] int,
	[sla_ms] int,
	[is_active] bit NOT NULL CONSTRAINT [process_definitions_is_active_default] DEFAULT ((1)),
	[created_at] datetime2(3) NOT NULL CONSTRAINT [process_definitions_created_at_default] DEFAULT (GETUTCDATE()),
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [process_definitions_updated_at_default] DEFAULT (GETUTCDATE()),
	CONSTRAINT [process_definitions_pkey] PRIMARY KEY([process_id])
);
--> statement-breakpoint
CREATE TABLE [account_timeline_summary] (
	[account_id] varchar(64),
	[first_event_at] datetime2(3) NOT NULL,
	[last_event_at] datetime2(3) NOT NULL,
	[total_events] int NOT NULL,
	[total_processes] int NOT NULL,
	[error_count] int NOT NULL CONSTRAINT [account_timeline_summary_error_count_default] DEFAULT ((0)),
	[last_process] varchar(510),
	[systems_touched] nvarchar(max),
	[correlation_ids] nvarchar(max),
	[updated_at] datetime2(3) NOT NULL CONSTRAINT [account_timeline_summary_updated_at_default] DEFAULT (GETUTCDATE()),
	CONSTRAINT [account_timeline_summary_pkey] PRIMARY KEY([account_id])
);
--> statement-breakpoint
CREATE INDEX [ix_event_logs_correlation_id] ON [event_logs] ([correlation_id],[event_timestamp]);--> statement-breakpoint
CREATE INDEX [ix_event_logs_account_id] ON [event_logs] ([account_id]);--> statement-breakpoint
CREATE INDEX [ix_event_logs_trace_id] ON [event_logs] ([trace_id]);--> statement-breakpoint
CREATE INDEX [ix_event_logs_process] ON [event_logs] ([process_name],[event_timestamp]);--> statement-breakpoint
CREATE INDEX [ix_event_logs_timestamp] ON [event_logs] ([event_timestamp]);--> statement-breakpoint
CREATE INDEX [ix_event_logs_status] ON [event_logs] ([event_status],[event_timestamp]);--> statement-breakpoint
CREATE INDEX [ix_event_logs_target_system] ON [event_logs] ([target_system],[event_timestamp]);--> statement-breakpoint
CREATE UNIQUE INDEX [ix_event_logs_idempotency] ON [event_logs] ([idempotency_key]);--> statement-breakpoint
CREATE INDEX [ix_event_logs_batch_id] ON [event_logs] ([batch_id],[correlation_id]);--> statement-breakpoint
CREATE INDEX [ix_correlation_links_account_id] ON [correlation_links] ([account_id]);--> statement-breakpoint
CREATE INDEX [ix_correlation_links_application_id] ON [correlation_links] ([application_id]);--> statement-breakpoint
CREATE UNIQUE INDEX [ix_process_definitions_name] ON [process_definitions] ([process_name]);--> statement-breakpoint
CREATE INDEX [ix_process_definitions_owning_team] ON [process_definitions] ([owning_team]);--> statement-breakpoint
CREATE INDEX [ix_account_timeline_summary_last_event] ON [account_timeline_summary] ([last_event_at]);