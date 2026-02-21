import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import mssql from "mssql";

type HttpMethod = "GET" | "POST";
type SuiteName = "core" | "search";
type EndpointName =
  | "by-account"
  | "by-correlation"
  | "by-trace"
  | "by-batch"
  | "lookup"
  | "search";

type BenchmarkOptions = {
  suite: SuiteName;
  baseUrl: string;
  runs: number;
  warmup: number;
  timeoutMs: number;
  endpointPageSizes: Record<EndpointName, number[]>;
};

type SampleIds = {
  accountId: string;
  correlationId: string;
  traceId: string;
  batchId: string;
  processName: string;
  searchQuery: string;
  latestEventTimestamp: string;
  totals: {
    account: number;
    correlation: number;
    trace: number;
    batch: number;
    process: number;
  };
};

type RequestSpec = {
  method: HttpMethod;
  path: string;
  body?: Record<string, unknown>;
};

type ResponseSnapshot = {
  status: number;
  durationMs: number;
  ok: boolean;
  totalCount: number | null;
  hasMore: boolean | null;
  eventsLength: number | null;
  error?: string;
};

type CurrentStats = {
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  successRate: number;
  failures: number;
  statusSample: number | null;
  errorSample: string | null;
  reference: {
    totalCount: number | null;
    hasMore: boolean | null;
    eventsLength: number | null;
  };
};

type CaseResult = {
  suite: SuiteName;
  endpoint: EndpointName;
  scenarioGroup: string;
  scenario: string;
  pageSize: number;
  page: number;
  expectedTotalCount: number | null;
  current: CurrentStats;
  correctness: {
    expectedTotalMatch: boolean;
    outOfRangeEmpty: boolean | null;
  };
};

type Gates = {
  noFailures: boolean;
  expectedTotalsMatch: boolean;
  outOfRangeEmpty: boolean;
  knownTradeoffs: {
    outOfRangeAvgMs: number | null;
    outOfRangeThresholdMs: number;
    outOfRangeWithinThreshold: boolean | null;
  };
  searchWindowSignals: {
    accountBaselineAvgMs: number | null;
    account1dAvgMs: number | null;
    account7dAvgMs: number | null;
    account30dAvgMs: number | null;
    narrowerWindowsImprove: boolean | null;
  };
};

type SearchScenario = {
  name: string;
  baseBody: Record<string, unknown>;
};

const OUT_OF_RANGE_THRESHOLD_MS = 40;

const DEFAULT_OPTIONS: BenchmarkOptions = {
  suite: "core",
  baseUrl: "http://localhost:3000",
  runs: 30,
  warmup: 5,
  timeoutMs: 10_000,
  endpointPageSizes: {
    "by-account": [10, 50, 100],
    "by-correlation": [10, 50, 200],
    "by-trace": [10, 50, 200],
    "by-batch": [10, 50, 100],
    lookup: [10, 50, 100],
    search: [10, 25, 50],
  },
};

function parsePageSizeList(input: string): number[] {
  return input
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseArgs(argv: string[]): BenchmarkOptions {
  const options: BenchmarkOptions = {
    ...DEFAULT_OPTIONS,
    endpointPageSizes: { ...DEFAULT_OPTIONS.endpointPageSizes },
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inlineValue] = arg.split("=");
    const nextValue = inlineValue ?? argv[i + 1];

    if (flag === "--suite") {
      if (nextValue !== "core" && nextValue !== "search") {
        throw new Error("--suite must be core or search");
      }
      options.suite = nextValue;
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--baseUrl") {
      options.baseUrl = nextValue;
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--runs") {
      options.runs = Number(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--warmup") {
      options.warmup = Number(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--timeoutMs") {
      options.timeoutMs = Number(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--pageSizes") {
      const list = parsePageSizeList(nextValue);
      options.endpointPageSizes = {
        "by-account": list,
        "by-correlation": list,
        "by-trace": list,
        "by-batch": list,
        lookup: list,
        search: list,
      };
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--pageSizesByAccount") {
      options.endpointPageSizes["by-account"] = parsePageSizeList(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--pageSizesByCorrelation") {
      options.endpointPageSizes["by-correlation"] = parsePageSizeList(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--pageSizesByTrace") {
      options.endpointPageSizes["by-trace"] = parsePageSizeList(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--pageSizesByBatch") {
      options.endpointPageSizes["by-batch"] = parsePageSizeList(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--pageSizesLookup") {
      options.endpointPageSizes.lookup = parsePageSizeList(nextValue);
      if (!inlineValue) i++;
      continue;
    }

    if (flag === "--pageSizesBySearch") {
      options.endpointPageSizes.search = parsePageSizeList(nextValue);
      if (!inlineValue) i++;
      continue;
    }
  }

  if (!Number.isFinite(options.runs) || options.runs <= 0) {
    throw new Error("--runs must be a positive number");
  }
  if (!Number.isFinite(options.warmup) || options.warmup < 0) {
    throw new Error("--warmup must be >= 0");
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("--timeoutMs must be a positive number");
  }

  for (const [endpoint, sizes] of Object.entries(options.endpointPageSizes)) {
    if (sizes.length === 0) {
      throw new Error(
        `${endpoint} page sizes are empty. Use --pageSizes or --pageSizesBy* with positive integers.`,
      );
    }
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
      requestTimeout: 60_000,
      connectTimeout: 30_000,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}

async function getTopGroupId(
  pool: mssql.ConnectionPool,
  column: "account_id" | "correlation_id" | "trace_id" | "batch_id",
): Promise<{ id: string; total: number }> {
  const result = await pool.request().query(`
    select top 1
      ${column} as id,
      cast(count(*) as int) as total
    from event_log
    where is_deleted = 0 and ${column} is not null
    group by ${column}
    order by count(*) desc;
  `);

  const row = result.recordset[0];
  if (!row?.id) {
    throw new Error(`No usable value found for ${column}. Run seed script first.`);
  }

  return { id: row.id, total: row.total ?? 0 };
}

async function getTopProcess(
  pool: mssql.ConnectionPool,
): Promise<{ processName: string; total: number }> {
  const result = await pool.request().query(`
    select top 1
      process_name as process_name,
      cast(count(*) as int) as total
    from event_log
    where is_deleted = 0 and process_name is not null
    group by process_name
    order by count(*) desc;
  `);

  const row = result.recordset[0];
  if (!row?.process_name) {
    throw new Error("No usable process_name found. Run seed script first.");
  }

  return {
    processName: row.process_name,
    total: row.total ?? 0,
  };
}

function extractQueryToken(input: string): string | null {
  const tokens = input.match(/[A-Za-z][A-Za-z0-9_]{3,}/g);
  return tokens?.[0] ?? null;
}

async function discoverSearchQuery(pool: mssql.ConnectionPool): Promise<string> {
  const benchmarkProbe = await pool
    .request()
    .query(
      `select top 1 summary from event_log where is_deleted = 0 and summary like '%benchmark%';`,
    );
  if (benchmarkProbe.recordset.length > 0) {
    return "benchmark";
  }

  const fallback = await pool
    .request()
    .query(
      `select top 1 summary from event_log where is_deleted = 0 and summary is not null order by event_timestamp desc;`,
    );
  const summary = fallback.recordset[0]?.summary as string | undefined;
  if (!summary) {
    return "process";
  }

  return extractQueryToken(summary) ?? "process";
}

async function discoverLatestTimestamp(pool: mssql.ConnectionPool): Promise<string> {
  const result = await pool
    .request()
    .query(
      `select top 1 event_timestamp from event_log where is_deleted = 0 order by event_timestamp desc;`,
    );

  const ts = result.recordset[0]?.event_timestamp as Date | string | undefined;
  if (!ts) {
    return new Date().toISOString();
  }

  return ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString();
}

async function discoverSamples(pool: mssql.ConnectionPool): Promise<SampleIds> {
  const account = await getTopGroupId(pool, "account_id");
  const correlation = await getTopGroupId(pool, "correlation_id");
  const trace = await getTopGroupId(pool, "trace_id");
  const batch = await getTopGroupId(pool, "batch_id");
  const process = await getTopProcess(pool);
  const searchQuery = await discoverSearchQuery(pool);
  const latestEventTimestamp = await discoverLatestTimestamp(pool);

  return {
    accountId: account.id,
    correlationId: correlation.id,
    traceId: trace.id,
    batchId: batch.id,
    processName: process.processName,
    searchQuery,
    latestEventTimestamp,
    totals: {
      account: account.total,
      correlation: correlation.total,
      trace: trace.total,
      batch: batch.total,
      process: process.total,
    },
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[index];
}

function calculateStats(snapshots: ResponseSnapshot[]): CurrentStats {
  const durations = snapshots.map((s) => s.durationMs).sort((a, b) => a - b);
  const sum = durations.reduce((acc, n) => acc + n, 0);
  const successes = snapshots.filter((s) => s.ok).length;
  const failures = snapshots.length - successes;
  const reference = snapshots.find((s) => s.ok) ?? snapshots[0] ?? null;
  const failureSample = snapshots.find((s) => !s.ok) ?? null;

  return {
    avgMs: durations.length > 0 ? sum / durations.length : 0,
    minMs: durations[0] ?? 0,
    maxMs: durations[durations.length - 1] ?? 0,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    successRate: snapshots.length > 0 ? successes / snapshots.length : 0,
    failures,
    statusSample: failureSample?.status ?? null,
    errorSample: failureSample?.error ?? null,
    reference: {
      totalCount: reference?.totalCount ?? null,
      hasMore: reference?.hasMore ?? null,
      eventsLength: reference?.eventsLength ?? null,
    },
  };
}

function scenarioPages(
  totalCount: number,
  pageSize: number,
): Array<{ name: string; page: number }> {
  const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const middlePage = Math.max(1, Math.ceil(lastPage / 2));
  const outOfRangePage = lastPage + 1;

  const scenarios = [
    { name: "first", page: 1 },
    { name: "middle", page: middlePage },
    { name: "last", page: lastPage },
    { name: "out_of_range", page: outOfRangePage },
  ];

  const dedup = new Map<number, { name: string; page: number }>();
  for (const scenario of scenarios) {
    if (!dedup.has(scenario.page)) {
      dedup.set(scenario.page, scenario);
    }
  }

  return [...dedup.values()];
}

async function executeRequest(
  baseUrl: string,
  spec: RequestSpec,
  timeoutMs: number,
): Promise<ResponseSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = process.hrtime.bigint();

  try {
    const response = await fetch(`${baseUrl}${spec.path}`, {
      method: spec.method,
      headers: spec.body ? { "content-type": "application/json" } : undefined,
      body: spec.body ? JSON.stringify(spec.body) : undefined,
      signal: controller.signal,
    });

    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    let parsed: Record<string, unknown> | null = null;
    let rawBody = "";

    try {
      rawBody = await response.text();
      parsed = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null;
    } catch {
      parsed = null;
    }

    const events = Array.isArray(parsed?.events)
      ? (parsed?.events as unknown[])
      : null;

    return {
      status: response.status,
      durationMs: elapsedMs,
      ok: response.ok,
      totalCount:
        typeof parsed?.total_count === "number"
          ? (parsed.total_count as number)
          : null,
      hasMore:
        typeof parsed?.has_more === "boolean"
          ? (parsed.has_more as boolean)
          : null,
      eventsLength: events ? events.length : null,
      error: response.ok
        ? undefined
        : parsed
          ? JSON.stringify(parsed)
          : rawBody || `HTTP ${response.status}`,
    };
  } catch (error) {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    return {
      status: 0,
      durationMs: elapsedMs,
      ok: false,
      totalCount: null,
      hasMore: null,
      eventsLength: null,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runCurrentMode(
  baseUrl: string,
  spec: RequestSpec,
  options: BenchmarkOptions,
): Promise<ResponseSnapshot[]> {
  const snapshots: ResponseSnapshot[] = [];

  for (let i = 0; i < options.warmup; i++) {
    await executeRequest(baseUrl, spec, options.timeoutMs);
  }

  for (let i = 0; i < options.runs; i++) {
    const snapshot = await executeRequest(baseUrl, spec, options.timeoutMs);
    snapshots.push(snapshot);
  }

  const failures = snapshots.filter((s) => !s.ok).length;
  console.log(
    `[current] ${spec.method} ${spec.path} -> ${snapshots.length - failures}/${snapshots.length} successful runs`,
  );

  if (failures > 0) {
    const sample = snapshots.find((s) => !s.ok);
    if (sample) {
      console.log(
        `[current] sample failure status=${sample.status} error=${sample.error ?? "unknown"}`,
      );
    }
  }

  return snapshots;
}

function buildCoreSpec(
  endpoint: Exclude<EndpointName, "search">,
  samples: SampleIds,
  pageSize: number,
  page: number,
): { request: RequestSpec; expectedTotal: number | null; scenarioGroup: string } {
  switch (endpoint) {
    case "by-account": {
      return {
        request: {
          method: "GET",
          path: `/v1/events/account/${encodeURIComponent(samples.accountId)}?page=${page}&page_size=${pageSize}`,
        },
        expectedTotal: samples.totals.account,
        scenarioGroup: "account",
      };
    }
    case "by-correlation": {
      return {
        request: {
          method: "GET",
          path: `/v1/events/correlation/${encodeURIComponent(samples.correlationId)}?page=${page}&page_size=${pageSize}`,
        },
        expectedTotal: samples.totals.correlation,
        scenarioGroup: "correlation",
      };
    }
    case "by-trace": {
      return {
        request: {
          method: "GET",
          path: `/v1/events/trace/${encodeURIComponent(samples.traceId)}?page=${page}&page_size=${pageSize}`,
        },
        expectedTotal: samples.totals.trace,
        scenarioGroup: "trace",
      };
    }
    case "by-batch": {
      return {
        request: {
          method: "GET",
          path: `/v1/events/batch/${encodeURIComponent(samples.batchId)}?page=${page}&page_size=${pageSize}`,
        },
        expectedTotal: samples.totals.batch,
        scenarioGroup: "batch",
      };
    }
    case "lookup": {
      return {
        request: {
          method: "POST",
          path: "/v1/events/lookup",
          body: {
            account_id: samples.accountId,
            page,
            page_size: pageSize,
          },
        },
        expectedTotal: samples.totals.account,
        scenarioGroup: "lookup_account",
      };
    }
    default:
      throw new Error(`Unsupported endpoint ${endpoint}`);
  }
}

function isoMinusDays(baseIso: string, days: number): { start: string; end: string } {
  const end = new Date(baseIso);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function buildSearchScenarios(samples: SampleIds): SearchScenario[] {
  const d1 = isoMinusDays(samples.latestEventTimestamp, 1);
  const d7 = isoMinusDays(samples.latestEventTimestamp, 7);
  const d30 = isoMinusDays(samples.latestEventTimestamp, 30);

  return [
    {
      name: "account_baseline",
      baseBody: { query: samples.searchQuery, account_id: samples.accountId },
    },
    {
      name: "process_baseline",
      baseBody: { query: samples.searchQuery, process_name: samples.processName },
    },
    {
      name: "account_1d",
      baseBody: {
        query: samples.searchQuery,
        account_id: samples.accountId,
        start_date: d1.start,
        end_date: d1.end,
      },
    },
    {
      name: "account_7d",
      baseBody: {
        query: samples.searchQuery,
        account_id: samples.accountId,
        start_date: d7.start,
        end_date: d7.end,
      },
    },
    {
      name: "account_30d",
      baseBody: {
        query: samples.searchQuery,
        account_id: samples.accountId,
        start_date: d30.start,
        end_date: d30.end,
      },
    },
  ];
}

async function probeSearchTotal(
  baseUrl: string,
  timeoutMs: number,
  scenario: SearchScenario,
): Promise<number> {
  const snapshot = await executeRequest(
    baseUrl,
    {
      method: "POST",
      path: "/v1/events/search/text",
      body: {
        ...scenario.baseBody,
        page: 1,
        page_size: 1,
      },
    },
    timeoutMs,
  );

  if (!snapshot.ok) {
    throw new Error(
      `Search probe failed for ${scenario.name}: status=${snapshot.status} error=${snapshot.error ?? "unknown"}`,
    );
  }

  return snapshot.totalCount ?? 0;
}

function evaluateGates(results: CaseResult[], suite: SuiteName): Gates {
  const noFailures = results.every((r) => r.current.failures === 0);
  const expectedTotalsMatch = results.every((r) => r.correctness.expectedTotalMatch);
  const outOfRangeEmpty = results
    .filter((r) => r.scenario === "out_of_range")
    .every((r) => r.correctness.outOfRangeEmpty === true);

  const outOfRangeRows = results.filter((r) => r.scenario === "out_of_range");
  const outOfRangeAvgMs =
    outOfRangeRows.length > 0
      ? outOfRangeRows.reduce((sum, r) => sum + r.current.avgMs, 0) /
        outOfRangeRows.length
      : null;

  const outOfRangeWithinThreshold =
    suite === "core" && outOfRangeAvgMs !== null
      ? outOfRangeAvgMs <= OUT_OF_RANGE_THRESHOLD_MS
      : null;

  const searchMean = (scenarioGroup: string): number | null => {
    const rows = results.filter((r) => r.scenarioGroup === scenarioGroup);
    if (rows.length === 0) return null;
    return rows.reduce((sum, r) => sum + r.current.avgMs, 0) / rows.length;
  };

  const accountBaselineAvgMs = suite === "search" ? searchMean("account_baseline") : null;
  const account1dAvgMs = suite === "search" ? searchMean("account_1d") : null;
  const account7dAvgMs = suite === "search" ? searchMean("account_7d") : null;
  const account30dAvgMs = suite === "search" ? searchMean("account_30d") : null;

  const narrowerWindowsImprove =
    suite === "search" &&
    accountBaselineAvgMs !== null &&
    account1dAvgMs !== null &&
    account7dAvgMs !== null &&
    account30dAvgMs !== null
      ? account1dAvgMs <= accountBaselineAvgMs && account7dAvgMs <= accountBaselineAvgMs
      : null;

  return {
    noFailures,
    expectedTotalsMatch,
    outOfRangeEmpty,
    knownTradeoffs: {
      outOfRangeAvgMs,
      outOfRangeThresholdMs: OUT_OF_RANGE_THRESHOLD_MS,
      outOfRangeWithinThreshold,
    },
    searchWindowSignals: {
      accountBaselineAvgMs,
      account1dAvgMs,
      account7dAvgMs,
      account30dAvgMs,
      narrowerWindowsImprove,
    },
  };
}

function buildMarkdown(
  config: BenchmarkOptions,
  samples: SampleIds,
  results: CaseResult[],
  gates: Gates,
): string {
  const lines: string[] = [];
  lines.push(`# ${config.suite === "core" ? "Core Pagination" : "Search"} Benchmark Results`);
  lines.push("");
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Suite: ${config.suite}`);
  lines.push(`- Base URL: ${config.baseUrl}`);
  lines.push(`- Runs: ${config.runs} (warmup ${config.warmup})`);
  lines.push(`- Timeout: ${config.timeoutMs}ms`);
  lines.push(`- Search query: \`${samples.searchQuery}\``);
  lines.push("");

  lines.push("## Samples");
  lines.push("");
  lines.push(`- account_id: \`${samples.accountId}\` (total ${samples.totals.account})`);
  lines.push(`- correlation_id: \`${samples.correlationId}\` (total ${samples.totals.correlation})`);
  lines.push(`- trace_id: \`${samples.traceId}\` (total ${samples.totals.trace})`);
  lines.push(`- batch_id: \`${samples.batchId}\` (total ${samples.totals.batch})`);
  lines.push(`- process_name: \`${samples.processName}\` (total ${samples.totals.process})`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push("| Endpoint | Scenario Group | Scenario | Page Size | Avg (ms) | p95 (ms) | Success Rate | Correctness |");
  lines.push("|---|---|---|---:|---:|---:|---:|---|");

  for (const result of results) {
    const correctnessPass =
      result.correctness.expectedTotalMatch &&
      (result.correctness.outOfRangeEmpty ?? true);

    lines.push(
      `| ${result.endpoint} | ${result.scenarioGroup} | ${result.scenario} | ${result.pageSize} | ${result.current.avgMs.toFixed(2)} | ${result.current.p95Ms.toFixed(2)} | ${(result.current.successRate * 100).toFixed(1)}% | ${correctnessPass ? "PASS" : "FAIL"} |`,
    );
  }

  lines.push("");
  lines.push("## Gates");
  lines.push("");
  lines.push(`- no_failures: ${gates.noFailures ? "PASS" : "FAIL"}`);
  lines.push(`- expected_totals_match: ${gates.expectedTotalsMatch ? "PASS" : "FAIL"}`);
  lines.push(`- out_of_range_empty: ${gates.outOfRangeEmpty ? "PASS" : "FAIL"}`);

  if (config.suite === "core") {
    lines.push(
      `- out_of_range_latency_within_threshold (${gates.knownTradeoffs.outOfRangeThresholdMs}ms): ${gates.knownTradeoffs.outOfRangeWithinThreshold ? "PASS" : "FAIL"}`,
    );
  }

  if (config.suite === "search") {
    lines.push(
      `- date_windowed_scenarios_improve_vs_baseline: ${gates.searchWindowSignals.narrowerWindowsImprove ? "PASS" : "FAIL"}`,
    );
  }

  lines.push("");
  lines.push("## Known Tradeoffs");
  lines.push("");
  lines.push(
    "- Out-of-range pages can be slower on COUNT(*) OVER() paths because empty page fetches cannot short-circuit like separate count+fetch.",
  );
  if (gates.knownTradeoffs.outOfRangeAvgMs !== null) {
    lines.push(
      `- Observed out-of-range average latency: ${gates.knownTradeoffs.outOfRangeAvgMs.toFixed(2)}ms`,
    );
  }

  if (config.suite === "search") {
    lines.push("");
    lines.push("## Search Window Signals");
    lines.push("");
    lines.push(
      `- account_baseline_avg_ms: ${gates.searchWindowSignals.accountBaselineAvgMs?.toFixed(2) ?? "n/a"}`,
    );
    lines.push(
      `- account_1d_avg_ms: ${gates.searchWindowSignals.account1dAvgMs?.toFixed(2) ?? "n/a"}`,
    );
    lines.push(
      `- account_7d_avg_ms: ${gates.searchWindowSignals.account7dAvgMs?.toFixed(2) ?? "n/a"}`,
    );
    lines.push(
      `- account_30d_avg_ms: ${gates.searchWindowSignals.account30dAvgMs?.toFixed(2) ?? "n/a"}`,
    );
  }

  return lines.join("\n");
}

async function runCoreSuite(
  options: BenchmarkOptions,
  samples: SampleIds,
): Promise<CaseResult[]> {
  const endpoints: Array<Exclude<EndpointName, "search">> = [
    "by-account",
    "by-correlation",
    "by-trace",
    "by-batch",
    "lookup",
  ];

  const results: CaseResult[] = [];

  for (const endpoint of endpoints) {
    for (const pageSize of options.endpointPageSizes[endpoint]) {
      const totalForScenarios =
        endpoint === "by-account" || endpoint === "lookup"
          ? samples.totals.account
          : endpoint === "by-correlation"
            ? samples.totals.correlation
            : endpoint === "by-trace"
              ? samples.totals.trace
              : samples.totals.batch;

      const scenarios = scenarioPages(totalForScenarios, pageSize);

      for (const scenario of scenarios) {
        const spec = buildCoreSpec(endpoint, samples, pageSize, scenario.page);

        console.log(
          `Running [core] ${endpoint} [${scenario.name}] page_size=${pageSize} page=${scenario.page}`,
        );

        const snapshots = await runCurrentMode(options.baseUrl, spec.request, options);
        const current = calculateStats(snapshots);

        const expectedTotalMatch =
          spec.expectedTotal === null
            ? true
            : current.reference.totalCount === spec.expectedTotal;

        const outOfRangeEmpty =
          scenario.name !== "out_of_range"
            ? null
            : (current.reference.eventsLength ?? -1) === 0;

        results.push({
          suite: "core",
          endpoint,
          scenarioGroup: spec.scenarioGroup,
          scenario: scenario.name,
          pageSize,
          page: scenario.page,
          expectedTotalCount: spec.expectedTotal,
          current,
          correctness: {
            expectedTotalMatch,
            outOfRangeEmpty,
          },
        });
      }
    }
  }

  return results;
}

async function runSearchSuite(
  options: BenchmarkOptions,
  samples: SampleIds,
): Promise<CaseResult[]> {
  const scenarioGroups = buildSearchScenarios(samples);
  const results: CaseResult[] = [];

  for (const scenarioGroup of scenarioGroups) {
    const expectedTotal = await probeSearchTotal(
      options.baseUrl,
      options.timeoutMs,
      scenarioGroup,
    );

    for (const pageSize of options.endpointPageSizes.search) {
      const scenarios = scenarioPages(expectedTotal, pageSize);

      for (const scenario of scenarios) {
        const request: RequestSpec = {
          method: "POST",
          path: "/v1/events/search/text",
          body: {
            ...scenarioGroup.baseBody,
            page: scenario.page,
            page_size: pageSize,
          },
        };

        console.log(
          `Running [search] ${scenarioGroup.name} [${scenario.name}] page_size=${pageSize} page=${scenario.page}`,
        );

        const snapshots = await runCurrentMode(options.baseUrl, request, options);
        const current = calculateStats(snapshots);

        const outOfRangeEmpty =
          scenario.name !== "out_of_range"
            ? null
            : (current.reference.eventsLength ?? -1) === 0;

        results.push({
          suite: "search",
          endpoint: "search",
          scenarioGroup: scenarioGroup.name,
          scenario: scenario.name,
          pageSize,
          page: scenario.page,
          expectedTotalCount: expectedTotal,
          current,
          correctness: {
            expectedTotalMatch: current.reference.totalCount === expectedTotal,
            outOfRangeEmpty,
          },
        });
      }
    }
  }

  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pool = await mssql.connect(getSqlConfig());

  try {
    console.log("Benchmark options:", options);
    const samples = await discoverSamples(pool);
    console.log("Discovered benchmark samples:", samples);

    const results =
      options.suite === "core"
        ? await runCoreSuite(options, samples)
        : await runSearchSuite(options, samples);

    const gates = evaluateGates(results, options.suite);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = resolve("benchmarks/results");
    await mkdir(outDir, { recursive: true });

    const jsonPath = resolve(outDir, `${timestamp}-${options.suite}.json`);
    const mdPath = resolve(outDir, `${timestamp}-${options.suite}.md`);

    const payload = {
      generatedAt: new Date().toISOString(),
      options,
      samples,
      gates,
      results,
    };

    await writeFile(jsonPath, JSON.stringify(payload, null, 2));
    await writeFile(mdPath, buildMarkdown(options, samples, results, gates));

    console.log(`Benchmark complete. JSON: ${jsonPath}`);
    console.log(`Benchmark summary markdown: ${mdPath}`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
