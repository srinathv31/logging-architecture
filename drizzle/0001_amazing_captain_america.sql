ALTER TABLE "event_logs" ADD COLUMN "span_links" jsonb;--> statement-breakpoint
ALTER TABLE "event_logs" ADD COLUMN "batch_id" varchar(200);--> statement-breakpoint
CREATE INDEX "ix_event_logs_batch_id" ON "event_logs" USING btree ("batch_id","correlation_id") WHERE "event_logs"."batch_id" IS NOT NULL;