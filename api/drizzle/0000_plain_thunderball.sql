CREATE TABLE "account_timeline_summary" (
	"account_id" varchar(64) PRIMARY KEY NOT NULL,
	"first_event_at" timestamp NOT NULL,
	"last_event_at" timestamp NOT NULL,
	"total_events" integer NOT NULL,
	"total_processes" integer NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_process" varchar(510),
	"systems_touched" jsonb,
	"correlation_ids" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correlation_links" (
	"correlation_id" varchar(200) PRIMARY KEY NOT NULL,
	"account_id" varchar(64) NOT NULL,
	"application_id" varchar(100),
	"customer_id" varchar(100),
	"card_number_last4" varchar(4),
	"linked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_logs" (
	"event_log_id" bigserial PRIMARY KEY NOT NULL,
	"execution_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"correlation_id" varchar(200) NOT NULL,
	"account_id" varchar(64),
	"trace_id" varchar(200) NOT NULL,
	"span_id" varchar(64),
	"parent_span_id" varchar(64),
	"application_id" varchar(200) NOT NULL,
	"target_system" varchar(200) NOT NULL,
	"originating_system" varchar(200) NOT NULL,
	"process_name" varchar(510) NOT NULL,
	"step_sequence" integer,
	"step_name" varchar(510),
	"event_type" varchar(50) NOT NULL,
	"event_status" varchar(50) NOT NULL,
	"identifiers" jsonb NOT NULL,
	"summary" text NOT NULL,
	"result" varchar(2048) NOT NULL,
	"metadata" jsonb,
	"event_timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"execution_time_ms" integer,
	"endpoint" varchar(510),
	"http_status_code" integer,
	"http_method" varchar(20),
	"error_code" varchar(100),
	"error_message" varchar(2048),
	"request_payload" text,
	"response_payload" text,
	"idempotency_key" varchar(128),
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ck_event_logs_event_type" CHECK ("event_logs"."event_type" IN ('PROCESS_START', 'STEP', 'PROCESS_END', 'ERROR')),
	CONSTRAINT "ck_event_logs_event_status" CHECK ("event_logs"."event_status" IN ('SUCCESS', 'FAILURE', 'IN_PROGRESS', 'SKIPPED')),
	CONSTRAINT "ck_event_logs_http_method" CHECK ("event_logs"."http_method" IS NULL OR "event_logs"."http_method" IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'))
);
--> statement-breakpoint
CREATE TABLE "process_definitions" (
	"process_id" serial PRIMARY KEY NOT NULL,
	"process_name" varchar(510) NOT NULL,
	"display_name" varchar(510) NOT NULL,
	"description" text NOT NULL,
	"owning_team" varchar(200) NOT NULL,
	"expected_steps" integer,
	"sla_ms" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ix_account_timeline_summary_last_event" ON "account_timeline_summary" USING btree ("last_event_at" DESC);--> statement-breakpoint
CREATE INDEX "ix_correlation_links_account_id" ON "correlation_links" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ix_correlation_links_application_id" ON "correlation_links" USING btree ("application_id") WHERE "correlation_links"."application_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ix_event_logs_correlation_id" ON "event_logs" USING btree ("correlation_id","event_timestamp");--> statement-breakpoint
CREATE INDEX "ix_event_logs_account_id" ON "event_logs" USING btree ("account_id") WHERE "event_logs"."account_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ix_event_logs_trace_id" ON "event_logs" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "ix_event_logs_process" ON "event_logs" USING btree ("process_name","event_timestamp");--> statement-breakpoint
CREATE INDEX "ix_event_logs_timestamp" ON "event_logs" USING btree ("event_timestamp");--> statement-breakpoint
CREATE INDEX "ix_event_logs_status" ON "event_logs" USING btree ("event_status","event_timestamp") WHERE "event_logs"."event_status" = 'FAILURE';--> statement-breakpoint
CREATE INDEX "ix_event_logs_target_system" ON "event_logs" USING btree ("target_system","event_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_event_logs_idempotency" ON "event_logs" USING btree ("idempotency_key") WHERE "event_logs"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ix_process_definitions_name" ON "process_definitions" USING btree ("process_name");--> statement-breakpoint
CREATE INDEX "ix_process_definitions_owning_team" ON "process_definitions" USING btree ("owning_team");