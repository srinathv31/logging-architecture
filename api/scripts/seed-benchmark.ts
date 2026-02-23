import "dotenv/config";
import mssql from "mssql";

type SeedOptions = {
  targetRows: number;
  chunkSize: number;
  seed: number;
  dryRun: boolean;
  forceTopup: boolean;
};

type DataProfile = {
  totalRows: number;
  activeRows: number;
  accounts: number;
  correlations: number;
  traces: number;
  batches: number;
  benchmarkRows: number;
};

type EventSeedRow = {
  correlationId: string;
  accountId: string | null;
  traceId: string;
  spanId: string | null;
  parentSpanId: string | null;
  batchId: string | null;
  applicationId: string;
  targetSystem: string;
  originatingSystem: string;
  processName: string;
  stepSequence: number;
  stepName: string;
  eventType: "PROCESS_START" | "STEP" | "PROCESS_END";
  eventStatus: "SUCCESS" | "FAILURE" | "IN_PROGRESS" | "SKIPPED";
  identifiers: string;
  summary: string;
  result: string;
  eventTimestamp: Date;
  executionTimeMs: number;
  endpoint: string | null;
  httpStatusCode: number | null;
  httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestPayload: string | null;
  responsePayload: string | null;
  isDeleted: boolean;
};

type CorrelationLinkSeedRow = {
  correlationId: string;
  accountId: string;
  applicationId: string;
  customerId: string;
  cardNumberLast4: string;
};

const DEFAULT_OPTIONS: SeedOptions = {
  targetRows: 10_000,
  chunkSize: 500,
  seed: 42,
  dryRun: false,
  forceTopup: false,
};

const PROCESS_NAMES = [
  "PAYMENT_SETTLEMENT",
  "BOOKING_CHECKOUT",
  "KYC_VERIFICATION",
  "ORDER_FULFILLMENT",
  "ACCOUNT_ORIGINATION",
];

const SYSTEMS = [
  "API_GATEWAY",
  "PET_RESORT",
  "STRIPE",
  "KAFKA",
  "INVENTORY_SERVICE",
  "RISK_ENGINE",
  "REPORTING_SERVICE",
];

const STEP_NAMES = [
  "Validate Request",
  "Load Context",
  "Call External API",
  "Apply Business Rules",
  "Persist Outcome",
  "Publish Event",
  "Finalize",
];

class LcgRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 2 ** 32;
  }

  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

function parseArgs(argv: string[]): SeedOptions {
  const options = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inlineValue] = arg.split("=");
    const nextValue = inlineValue ?? argv[i + 1];

    if (flag === "--targetRows") {
      options.targetRows = Number(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--chunkSize") {
      options.chunkSize = Number(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--seed") {
      options.seed = Number(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--dryRun") {
      options.dryRun = true;
      continue;
    }

    if (flag === "--forceTopup") {
      options.forceTopup = true;
      continue;
    }
  }

  if (!Number.isFinite(options.targetRows) || options.targetRows <= 0) {
    throw new Error("--targetRows must be a positive number");
  }
  if (!Number.isFinite(options.chunkSize) || options.chunkSize <= 0) {
    throw new Error("--chunkSize must be a positive number");
  }

  return options;
}

function getSqlConfig(): mssql.config {
  const server = process.env.DB_SERVER;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!server || !database) {
    throw new Error("DB_SERVER and DB_NAME are required");
  }

  if (!user || !password) {
    throw new Error(
      "DB_USER and DB_PASSWORD are required for benchmark scripts in local/docker mode",
    );
  }

  return {
    server,
    user,
    password,
    options: {
      database,
      encrypt: false,
      trustServerCertificate: true,
      requestTimeout: 120_000,
      connectTimeout: 30_000,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}

async function getProfile(pool: mssql.ConnectionPool): Promise<DataProfile> {
  const result = await pool.request().query(`
    select
      cast(count(*) as int) as total_rows,
      cast(sum(case when is_deleted = 0 then 1 else 0 end) as int) as active_rows,
      cast(count(distinct account_id) as int) as accounts,
      cast(count(distinct correlation_id) as int) as correlations,
      cast(count(distinct trace_id) as int) as traces,
      cast(count(distinct batch_id) as int) as batches,
      cast(sum(case when correlation_id like 'bench-corr-%' then 1 else 0 end) as int) as benchmark_rows
    from event_log;
  `);

  const row = result.recordset[0];
  return {
    totalRows: row.total_rows ?? 0,
    activeRows: row.active_rows ?? 0,
    accounts: row.accounts ?? 0,
    correlations: row.correlations ?? 0,
    traces: row.traces ?? 0,
    batches: row.batches ?? 0,
    benchmarkRows: row.benchmark_rows ?? 0,
  };
}

function buildRows(
  count: number,
  seed: number,
  runTag: string,
): { events: EventSeedRow[]; links: CorrelationLinkSeedRow[] } {
  const rng = new LcgRng(seed);
  const events: EventSeedRow[] = [];
  const links: CorrelationLinkSeedRow[] = [];

  let correlationSeq = 0;

  while (events.length < count) {
    correlationSeq++;

    const correlationId = `bench-corr-${runTag}-${correlationSeq}`;
    const traceId = `bench-trace-${runTag}-${Math.floor(correlationSeq / 2)}`;
    const accountId = rng.next() < 0.1
      ? null
      : `bench-acc-${String(rng.int(1, 250)).padStart(4, "0")}`;
    const batchId = `bench-batch-${runTag}-${String(Math.floor(correlationSeq / 12)).padStart(5, "0")}`;

    const processName = rng.pick(PROCESS_NAMES);
    const applicationId = `bench-app-${rng.int(1, 8)}`;
    const stepCount = rng.int(5, 14);
    const baseTs = Date.now() - rng.int(0, 1000 * 60 * 60 * 24 * 45);

    if (accountId) {
      links.push({
        correlationId,
        accountId,
        applicationId,
        customerId: `bench-customer-${rng.int(1000, 9999)}`,
        cardNumberLast4: String(rng.int(1000, 9999)),
      });
    }

    const processFails = rng.next() < 0.08;

    for (let step = 1; step <= stepCount; step++) {
      if (events.length >= count) break;

      const isFirst = step === 1;
      const isLast = step === stepCount;
      const eventType: EventSeedRow["eventType"] = isFirst
        ? "PROCESS_START"
        : isLast
          ? "PROCESS_END"
          : "STEP";

      const eventStatus: EventSeedRow["eventStatus"] =
        isLast && processFails ? "FAILURE" : "SUCCESS";

      const stepName = isFirst
        ? "Start"
        : isLast
          ? "End"
          : rng.pick(STEP_NAMES);

      const targetSystem = isFirst
        ? "API_GATEWAY"
        : rng.pick(SYSTEMS);

      const originatingSystem = isFirst
        ? "CLIENT_APP"
        : "EVENT_LOG_API";

      const executionTimeMs = rng.int(5, 1500);
      const isError = eventStatus === "FAILURE";

      const timestamp = new Date(baseTs + step * rng.int(20, 500));
      const spanId = `${correlationSeq.toString(16)}-${step.toString(16)}-${rng.int(1000, 9999)}`;
      const parentSpanId = step > 1
        ? `${correlationSeq.toString(16)}-${(step - 1).toString(16)}-${rng.int(1000, 9999)}`
        : null;

      events.push({
        correlationId,
        accountId,
        traceId,
        spanId,
        parentSpanId,
        batchId,
        applicationId,
        targetSystem,
        originatingSystem,
        processName,
        stepSequence: step,
        stepName,
        eventType,
        eventStatus,
        identifiers: JSON.stringify({
          account_id: accountId,
          correlation_id: correlationId,
          trace_id: traceId,
          benchmark: true,
          step,
        }),
        summary: `[benchmark] ${processName} ${stepName} step ${step}`,
        result: isError ? "FAILED" : "OK",
        eventTimestamp: timestamp,
        executionTimeMs,
        endpoint: `/api/v1/${processName.toLowerCase()}`,
        httpStatusCode: isError ? 500 : 200,
        httpMethod: rng.pick(["GET", "POST", "PUT", "PATCH"]),
        errorCode: isError ? "BENCH_ERR" : null,
        errorMessage: isError ? "Synthetic benchmark failure" : null,
        requestPayload: JSON.stringify({
          benchmark: true,
          process: processName,
          step,
        }),
        responsePayload: JSON.stringify({
          success: !isError,
          duration_ms: executionTimeMs,
        }),
        isDeleted: false,
      });
    }
  }

  return { events, links };
}

async function bulkInsertEvents(
  pool: mssql.ConnectionPool,
  rows: EventSeedRow[],
  chunkSize: number,
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const table = new mssql.Table("event_log");
    table.create = false;

    table.columns.add("correlation_id", mssql.VarChar(200), { nullable: false });
    table.columns.add("account_id", mssql.VarChar(64), { nullable: true });
    table.columns.add("trace_id", mssql.VarChar(200), { nullable: false });
    table.columns.add("span_id", mssql.VarChar(64), { nullable: true });
    table.columns.add("parent_span_id", mssql.VarChar(64), { nullable: true });
    table.columns.add("batch_id", mssql.VarChar(200), { nullable: true });
    table.columns.add("application_id", mssql.VarChar(200), { nullable: false });
    table.columns.add("target_system", mssql.VarChar(200), { nullable: false });
    table.columns.add("originating_system", mssql.VarChar(200), { nullable: false });
    table.columns.add("process_name", mssql.VarChar(510), { nullable: false });
    table.columns.add("step_sequence", mssql.Int, { nullable: true });
    table.columns.add("step_name", mssql.VarChar(510), { nullable: true });
    table.columns.add("event_type", mssql.VarChar(50), { nullable: false });
    table.columns.add("event_status", mssql.VarChar(50), { nullable: false });
    table.columns.add("identifiers", mssql.NVarChar(mssql.MAX), { nullable: false });
    table.columns.add("summary", mssql.NVarChar(mssql.MAX), { nullable: false });
    table.columns.add("result", mssql.VarChar(2048), { nullable: false });
    table.columns.add("event_timestamp", mssql.DateTime2(3), { nullable: false });
    table.columns.add("execution_time_ms", mssql.Int, { nullable: true });
    table.columns.add("endpoint", mssql.VarChar(510), { nullable: true });
    table.columns.add("http_status_code", mssql.Int, { nullable: true });
    table.columns.add("http_method", mssql.VarChar(20), { nullable: true });
    table.columns.add("error_code", mssql.VarChar(100), { nullable: true });
    table.columns.add("error_message", mssql.VarChar(2048), { nullable: true });
    table.columns.add("request_payload", mssql.NVarChar(mssql.MAX), { nullable: true });
    table.columns.add("response_payload", mssql.NVarChar(mssql.MAX), { nullable: true });
    table.columns.add("is_deleted", mssql.Bit, { nullable: false });

    for (const row of chunk) {
      table.rows.add(
        row.correlationId,
        row.accountId,
        row.traceId,
        row.spanId,
        row.parentSpanId,
        row.batchId,
        row.applicationId,
        row.targetSystem,
        row.originatingSystem,
        row.processName,
        row.stepSequence,
        row.stepName,
        row.eventType,
        row.eventStatus,
        row.identifiers,
        row.summary,
        row.result,
        row.eventTimestamp,
        row.executionTimeMs,
        row.endpoint,
        row.httpStatusCode,
        row.httpMethod,
        row.errorCode,
        row.errorMessage,
        row.requestPayload,
        row.responsePayload,
        row.isDeleted,
      );
    }

    await pool.request().bulk(table);
    console.log(`Inserted event rows ${i + 1}-${Math.min(i + chunk.length, rows.length)}`);
  }
}

async function bulkInsertCorrelationLinks(
  pool: mssql.ConnectionPool,
  rows: CorrelationLinkSeedRow[],
  chunkSize: number,
) {
  if (rows.length === 0) return;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const table = new mssql.Table("correlation_links");
    table.create = false;

    table.columns.add("correlation_id", mssql.VarChar(200), { nullable: false });
    table.columns.add("account_id", mssql.VarChar(64), { nullable: false });
    table.columns.add("application_id", mssql.VarChar(100), { nullable: true });
    table.columns.add("customer_id", mssql.VarChar(100), { nullable: true });
    table.columns.add("card_number_last4", mssql.VarChar(4), { nullable: true });

    for (const row of chunk) {
      table.rows.add(
        row.correlationId,
        row.accountId,
        row.applicationId,
        row.customerId,
        row.cardNumberLast4,
      );
    }

    await pool.request().bulk(table);
    console.log(`Inserted correlation links ${i + 1}-${Math.min(i + chunk.length, rows.length)}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getSqlConfig();

  console.log("Benchmark seed options:", options);
  const pool = await mssql.connect(config);

  try {
    const before = await getProfile(pool);
    console.log("Current profile:", before);

    const deficit = Math.max(0, options.targetRows - before.activeRows);
    if (deficit === 0 && !options.forceTopup) {
      console.log(
        `No top-up needed. Active rows (${before.activeRows}) already >= targetRows (${options.targetRows}).`,
      );
      return;
    }

    const rowsToInsert = options.forceTopup ? options.targetRows : deficit;
    const runTag = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${options.seed}`;

    const { events, links } = buildRows(rowsToInsert, options.seed, runTag);
    console.log(
      `Prepared ${events.length} event rows and ${links.length} correlation links (dryRun=${options.dryRun}).`,
    );

    if (!options.dryRun) {
      await bulkInsertEvents(pool, events, options.chunkSize);
      await bulkInsertCorrelationLinks(pool, links, options.chunkSize);
    }

    const after = await getProfile(pool);
    console.log("Updated profile:", after);

    console.log(
      JSON.stringify(
        {
          insertedEvents: options.dryRun ? 0 : events.length,
          insertedCorrelationLinks: options.dryRun ? 0 : links.length,
          before,
          after,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error("Seed benchmark failed:", error);
  process.exit(1);
});
