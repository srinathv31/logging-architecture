/**
 * Employee Card Origination — Example Script
 *
 * Walks through the full Employee Card Origination flow from Event_Log_Schema_v1_4.md.
 * Demonstrates single event creation, correlation linking, querying, batch upload,
 * and batch summary.
 *
 * Usage:
 *   npx tsx examples/employee-card-origination.ts
 *
 * Prerequisites:
 *   - Dev server running: npm run dev
 *   - Database migrated
 *
 * Environment:
 *   BASE_URL — override the default http://localhost:8080/v1
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080/v1";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function apiCall(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  console.log(`\n>>> ${method} ${url}`);
  if (body) {
    console.log(
      "    Body:",
      JSON.stringify(body, null, 2).split("\n").join("\n    "),
    );
  }

  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  console.log(`<<< ${res.status} ${res.statusText}`);
  console.log(
    "    Response:",
    JSON.stringify(data, null, 2).split("\n").join("\n    "),
  );

  if (!res.ok) {
    console.error(`!!! Request failed: ${res.status}`);
  }

  return data;
}

function section(title: string) {
  console.log("\n" + "=".repeat(70));
  console.log(`  ${title}`);
  console.log("=".repeat(70));
}

const BASE_TIME = new Date();
function ts(offsetMs: number): string {
  return new Date(BASE_TIME.getTime() + offsetMs).toISOString();
}

// ---------------------------------------------------------------------------
// Shared identifiers for the single-employee flow
// ---------------------------------------------------------------------------

const CORRELATION_ID = `corr-emp-${BASE_TIME.toISOString().slice(0, 10).replace(/-/g, "")}-a1b2c3`;
const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PROCESS_NAME = "EMPLOYEE_CARD_ORIGINATION";
const APP_ID = "employee-origination-service";

// ---------------------------------------------------------------------------
// Section 1 — Single Employee Origination (6 events)
// ---------------------------------------------------------------------------

async function singleEmployeeOrigination() {
  section("Section 1: Single Employee Origination (EMP-456) — 6 Events");

  const baseEvent = {
    correlationId: CORRELATION_ID,
    traceId: TRACE_ID,
    applicationId: APP_ID,
    processName: PROCESS_NAME,
    accountId: null, // origination — no account yet
  };

  // Event 1 — Process Start
  console.log("\n--- Event 1: Process Start ---");
  await apiCall("POST", "/events", {
    ...baseEvent,
    spanId: "a1b2c3d4e5f60001",
    originatingSystem: "HR_PORTAL",
    targetSystem: "EMPLOYEE_ORIGINATION_SERVICE",
    stepSequence: 0,
    eventType: "PROCESS_START",
    eventStatus: "SUCCESS",
    identifiers: { employee_id: "EMP-456", session_id: "sess-xyz" },
    summary:
      "Employee card origination initiated for employee EMP-456 via HR portal",
    result: "INITIATED",
    endpoint: "/api/v1/employee/apply",
    httpMethod: "POST",
    eventTimestamp: ts(0),
  });

  // Event 2 — HR Validation (Step 1)
  console.log("\n--- Event 2: HR Validation ---");
  await apiCall("POST", "/events", {
    ...baseEvent,
    spanId: "a1b2c3d4e5f60002",
    parentSpanId: "a1b2c3d4e5f60001",
    originatingSystem: "EMPLOYEE_ORIGINATION_SERVICE",
    targetSystem: "WORKDAY",
    stepSequence: 1,
    stepName: "HR Validation",
    eventType: "STEP",
    eventStatus: "SUCCESS",
    identifiers: { employee_id: "EMP-456", workday_ref: "WD-789012" },
    summary:
      "Validated employee EMP-456 exists in Workday - active status confirmed, hire date 2022-03-15, department: Engineering",
    result: "EMPLOYEE_VERIFIED",
    endpoint: "/api/v1/employees/EMP-456/verify",
    httpMethod: "GET",
    httpStatusCode: 200,
    executionTimeMs: 245,
    eventTimestamp: ts(250),
  });

  // Event 3a — Create ODS Entry (Step 2, parallel)
  console.log("\n--- Event 3a: Create ODS Entry (parallel step 2) ---");
  await apiCall("POST", "/events", {
    ...baseEvent,
    spanId: "a1b2c3d4e5f60003",
    parentSpanId: "a1b2c3d4e5f60002",
    originatingSystem: "EMPLOYEE_ORIGINATION_SERVICE",
    targetSystem: "ODS",
    stepSequence: 2,
    stepName: "Create ODS Entry",
    eventType: "STEP",
    eventStatus: "SUCCESS",
    identifiers: { employee_id: "EMP-456", ods_record_id: "ODS-334455" },
    summary:
      "Created ODS record ODS-334455 for employee EMP-456 - applicant profile initialized",
    result: "ODS_RECORD_CREATED",
    endpoint: "/api/v1/applicants",
    httpMethod: "POST",
    httpStatusCode: 201,
    executionTimeMs: 180,
    eventTimestamp: ts(500),
  });

  // Event 3b — Initialize Regulatory Controls (Step 2, parallel)
  console.log(
    "\n--- Event 3b: Initialize Regulatory Controls (parallel step 2) ---",
  );
  await apiCall("POST", "/events", {
    ...baseEvent,
    spanId: "a1b2c3d4e5f60004",
    parentSpanId: "a1b2c3d4e5f60002",
    originatingSystem: "EMPLOYEE_ORIGINATION_SERVICE",
    targetSystem: "COMPLIANCE_SERVICE",
    stepSequence: 2,
    stepName: "Initialize Regulatory Controls",
    eventType: "STEP",
    eventStatus: "SUCCESS",
    identifiers: {
      employee_id: "EMP-456",
      compliance_case_id: "COMP-667788",
    },
    summary:
      "Initialized regulatory controls case COMP-667788 for employee EMP-456 - OFAC/KYC checks queued",
    result: "CONTROLS_INITIALIZED",
    endpoint: "/api/v1/compliance/initialize",
    httpMethod: "POST",
    httpStatusCode: 201,
    executionTimeMs: 95,
    requestPayload: JSON.stringify({
      employee_id: "EMP-456",
      check_types: ["OFAC", "KYC", "AML"],
      priority: "STANDARD",
      source_system: "EMPLOYEE_ORIGINATION_SERVICE",
    }),
    responsePayload: JSON.stringify({
      compliance_case_id: "COMP-667788",
      status: "QUEUED",
      queued_checks: [
        { type: "OFAC", estimated_completion: "2025-01-26T10:00:01.000Z" },
        { type: "KYC", estimated_completion: "2025-01-26T10:00:02.000Z" },
        { type: "AML", estimated_completion: "2025-01-26T10:00:02.500Z" },
      ],
      created_at: ts(500),
    }),
    eventTimestamp: ts(500),
  });

  // Event 4 — Background/Regulatory Checks (Step 3, fork-join)
  console.log("\n--- Event 4: Background & Regulatory Checks (fork-join) ---");
  await apiCall("POST", "/events", {
    ...baseEvent,
    spanId: "a1b2c3d4e5f60005",
    parentSpanId: "a1b2c3d4e5f60002",
    spanLinks: ["a1b2c3d4e5f60003", "a1b2c3d4e5f60004"],
    originatingSystem: "EMPLOYEE_ORIGINATION_SERVICE",
    targetSystem: "BACKGROUND_CHECK_VENDOR",
    stepSequence: 3,
    stepName: "Background and Regulatory Checks",
    eventType: "STEP",
    eventStatus: "SUCCESS",
    identifiers: {
      employee_id: "EMP-456",
      compliance_case_id: "COMP-667788",
      vendor_reference_id: "BGC-112233",
    },
    summary:
      "Background and regulatory checks completed for employee EMP-456 - OFAC clear, no adverse findings, risk score: LOW",
    result: "CHECKS_PASSED",
    endpoint: "/api/v2/background-check/execute",
    httpMethod: "POST",
    httpStatusCode: 200,
    executionTimeMs: 1850,
    requestPayload: JSON.stringify({
      employee_id: "EMP-456",
      compliance_case_id: "COMP-667788",
      vendor_reference_id: "BGC-112233",
      check_types: [
        "CRIMINAL",
        "CREDIT",
        "EMPLOYMENT",
        "EDUCATION",
        "OFAC",
        "KYC",
        "AML",
      ],
      applicant_consent_ref: "CONSENT-EMP456-20250126",
    }),
    responsePayload: JSON.stringify({
      vendor_reference_id: "BGC-112233",
      overall_status: "CLEAR",
      results: [
        { check: "CRIMINAL", status: "CLEAR", details: "No records found" },
        { check: "CREDIT", status: "CLEAR", details: "Score: 780" },
        {
          check: "EMPLOYMENT",
          status: "VERIFIED",
          details: "Current employer confirmed",
        },
        {
          check: "EDUCATION",
          status: "VERIFIED",
          details: "Degree confirmed",
        },
        { check: "OFAC", status: "CLEAR", details: "No matches" },
        { check: "KYC", status: "VERIFIED", details: "Identity confirmed" },
        { check: "AML", status: "CLEAR", details: "No adverse findings" },
      ],
      risk_score: "LOW",
      completed_at: ts(2550),
    }),
    eventTimestamp: ts(2550),
  });

  // Event 5 — ADM Decision (Step 4)
  console.log("\n--- Event 5: ADM Decision ---");
  await apiCall("POST", "/events", {
    ...baseEvent,
    accountId: "AC-EMP-001234",
    spanId: "a1b2c3d4e5f60006",
    parentSpanId: "a1b2c3d4e5f60005",
    originatingSystem: "EMPLOYEE_ORIGINATION_SERVICE",
    targetSystem: "ACE_DECISION_MATRIX",
    stepSequence: 4,
    stepName: "ADM Decision",
    eventType: "STEP",
    eventStatus: "SUCCESS",
    identifiers: {
      employee_id: "EMP-456",
      applicationId: "APP-998877",
      adm_decision_id: "DEC-445566",
    },
    summary:
      "Submitted application APP-998877 to Ace Decision Matrix for employee EMP-456 - decision rendered: APPROVED, credit limit $10,000",
    result: "APPROVED",
    endpoint: "/api/v1/decisions/evaluate",
    httpMethod: "POST",
    httpStatusCode: 200,
    executionTimeMs: 620,
    requestPayload: JSON.stringify({
      applicationId: "APP-998877",
      employee_id: "EMP-456",
      risk_score: "LOW",
      employment_status: "ACTIVE",
      department: "Engineering",
      years_of_service: 3,
      background_check_ref: "BGC-112233",
      compliance_case_ref: "COMP-667788",
    }),
    responsePayload: JSON.stringify({
      decision_id: "DEC-445566",
      applicationId: "APP-998877",
      decision: "APPROVED",
      credit_limit: 10000,
      card_type: "EMPLOYEE_CORPORATE",
      accountId: "AC-EMP-001234",
      conditions: [],
      decided_at: ts(3200),
    }),
    eventTimestamp: ts(3200),
  });

  // Event 6 — Process End (Step 5)
  console.log("\n--- Event 6: Process End ---");
  await apiCall("POST", "/events", {
    ...baseEvent,
    accountId: "AC-EMP-001234",
    spanId: "a1b2c3d4e5f60007",
    parentSpanId: "a1b2c3d4e5f60001",
    originatingSystem: "EMPLOYEE_ORIGINATION_SERVICE",
    targetSystem: "HR_PORTAL",
    stepSequence: 5,
    stepName: "Return Decision",
    eventType: "PROCESS_END",
    eventStatus: "SUCCESS",
    identifiers: {
      employee_id: "EMP-456",
      applicationId: "APP-998877",
      adm_decision_id: "DEC-445566",
    },
    summary:
      "Employee card origination completed for EMP-456 - APPROVED with $10,000 limit, card to be issued to office address",
    result: "COMPLETED_APPROVED",
    httpStatusCode: 200,
    executionTimeMs: 3200,
    eventTimestamp: ts(3250),
  });
}

// ---------------------------------------------------------------------------
// Section 2 — Create Correlation Link
// ---------------------------------------------------------------------------

async function createCorrelationLink() {
  section("Section 2: Create Correlation Link");

  await apiCall("POST", "/correlation-links", {
    correlationId: CORRELATION_ID,
    accountId: "AC-EMP-001234",
    applicationId: "APP-998877",
    customerId: "EMP-456",
  });
}

// ---------------------------------------------------------------------------
// Section 3 — Query by Correlation
// ---------------------------------------------------------------------------

async function queryByCorrelation() {
  section("Section 3: Query by Correlation");

  const data = (await apiCall(
    "GET",
    `/events/correlation/${CORRELATION_ID}`,
  )) as {
    correlationId: string;
    accountId: string | null;
    events: Array<{
      eventType: string;
      eventStatus: string;
      stepName: string | null;
      eventTimestamp: string;
      summary: string;
    }>;
    isLinked: boolean;
  };

  if (data?.events) {
    console.log("\n--- Timeline ---");
    for (const e of data.events) {
      console.log(
        `  [${e.eventTimestamp}] ${e.eventType} / ${e.eventStatus} — ${e.stepName ?? "(process)"}: ${e.summary.slice(0, 80)}...`,
      );
    }
    console.log(`\n  Linked: ${data.isLinked}, Account: ${data.accountId}`);
  }
}

// ---------------------------------------------------------------------------
// Section 4 — Query by Trace
// ---------------------------------------------------------------------------

async function queryByTrace() {
  section("Section 4: Query by Trace");

  const data = (await apiCall("GET", `/events/trace/${TRACE_ID}`)) as {
    traceId: string;
    events: unknown[];
    systemsInvolved: string[];
    totalDurationMs: number | null;
  };

  if (data?.systemsInvolved) {
    console.log("\n--- Trace Summary ---");
    console.log(`  Systems involved: ${data.systemsInvolved.join(", ")}`);
    console.log(`  Total duration:   ${data.totalDurationMs ?? "N/A"} ms`);
    console.log(`  Event count:      ${data.events.length}`);
  }
}

// ---------------------------------------------------------------------------
// Section 5 — Batch Upload (3 employees)
// ---------------------------------------------------------------------------

const BATCH_ID = `batch-${BASE_TIME.toISOString().slice(0, 10).replace(/-/g, "")}-hr-upload-x7y8z9`;

async function batchUpload() {
  section("Section 5: Batch Upload (3 Employees)");

  function makeProcessStart(
    empId: string,
    correlationId: string,
    traceId: string,
    spanId: string,
  ) {
    return {
      correlationId: correlationId,
      traceId: traceId,
      spanId: spanId,
      accountId: null,
      applicationId: APP_ID,
      originatingSystem: "HR_PORTAL",
      targetSystem: "EMPLOYEE_ORIGINATION_SERVICE",
      processName: PROCESS_NAME,
      stepSequence: 0,
      eventType: "PROCESS_START" as const,
      eventStatus: "SUCCESS" as const,
      identifiers: { employee_id: empId },
      summary: `Employee card origination initiated for employee ${empId} via batch upload`,
      result: "INITIATED",
      endpoint: "/api/v1/employee/apply",
      httpMethod: "POST" as const,
      eventTimestamp: ts(3_600_000),
    };
  }

  function makeProcessEnd(
    empId: string,
    correlationId: string,
    traceId: string,
    spanId: string,
    parentSpanId: string,
  ) {
    return {
      correlationId: correlationId,
      traceId: traceId,
      spanId: spanId,
      parentSpanId: parentSpanId,
      accountId: null,
      applicationId: APP_ID,
      originatingSystem: "EMPLOYEE_ORIGINATION_SERVICE",
      targetSystem: "HR_PORTAL",
      processName: PROCESS_NAME,
      stepSequence: 5,
      stepName: "Return Decision",
      eventType: "PROCESS_END" as const,
      eventStatus: "SUCCESS" as const,
      identifiers: { employee_id: empId },
      summary: `Employee card origination completed for ${empId} - APPROVED`,
      result: "COMPLETED_APPROVED",
      httpStatusCode: 200,
      executionTimeMs: 2800,
      eventTimestamp: ts(3_603_000),
    };
  }

  function makeErrorEvent(
    empId: string,
    correlationId: string,
    traceId: string,
    spanId: string,
    parentSpanId: string,
  ) {
    return {
      correlationId: correlationId,
      traceId: traceId,
      spanId: spanId,
      parentSpanId: parentSpanId,
      accountId: null,
      applicationId: APP_ID,
      originatingSystem: "EMPLOYEE_ORIGINATION_SERVICE",
      targetSystem: "BACKGROUND_CHECK_VENDOR",
      processName: PROCESS_NAME,
      stepSequence: 3,
      stepName: "Background and Regulatory Checks",
      eventType: "ERROR" as const,
      eventStatus: "FAILURE" as const,
      identifiers: { employee_id: empId },
      summary: `Background check failed for ${empId} - adverse findings, risk score: HIGH`,
      result: "CHECKS_FAILED",
      errorCode: "BGC_ADVERSE_FINDINGS",
      errorMessage:
        "Background check returned adverse findings — manual review required",
      endpoint: "/api/v2/background-check/execute",
      httpMethod: "POST" as const,
      httpStatusCode: 200,
      executionTimeMs: 1500,
      eventTimestamp: ts(3_602_000),
    };
  }

  const batchEvents = [
    // EMP-101: full success
    makeProcessStart(
      "EMP-101",
      "corr-emp-101-batch",
      "aa11bb22cc33dd44ee55ff6600110101",
      "aa11bb22cc330101",
    ),
    makeProcessEnd(
      "EMP-101",
      "corr-emp-101-batch",
      "aa11bb22cc33dd44ee55ff6600110101",
      "aa11bb22cc330102",
      "aa11bb22cc330101",
    ),
    // EMP-102: full success
    makeProcessStart(
      "EMP-102",
      "corr-emp-102-batch",
      "aa11bb22cc33dd44ee55ff6600110201",
      "aa11bb22cc330201",
    ),
    makeProcessEnd(
      "EMP-102",
      "corr-emp-102-batch",
      "aa11bb22cc33dd44ee55ff6600110201",
      "aa11bb22cc330202",
      "aa11bb22cc330201",
    ),
    // EMP-103: fails at background check
    makeProcessStart(
      "EMP-103",
      "corr-emp-103-batch",
      "aa11bb22cc33dd44ee55ff6600110301",
      "aa11bb22cc330301",
    ),
    makeErrorEvent(
      "EMP-103",
      "corr-emp-103-batch",
      "aa11bb22cc33dd44ee55ff6600110301",
      "aa11bb22cc330302",
      "aa11bb22cc330301",
    ),
  ];

  await apiCall("POST", "/events/batch", {
    batchId: BATCH_ID,
    events: batchEvents,
  });
}

// ---------------------------------------------------------------------------
// Section 6 — Query Batch Events
// ---------------------------------------------------------------------------

async function queryBatchEvents() {
  section("Section 6: Query Batch Events");

  const data = (await apiCall(
    "GET",
    `/events/batch/${BATCH_ID}?page=1&pageSize=20`,
  )) as {
    batchId: string;
    events: Array<{
      eventType: string;
      eventStatus: string;
      correlationId: string;
      summary: string;
    }>;
    totalCount: number;
    uniqueCorrelationIds: number;
    successCount: number;
    failureCount: number;
    hasMore: boolean;
  };

  if (data?.events) {
    console.log("\n--- Batch Events ---");
    console.log(`  Total events:          ${data.totalCount}`);
    console.log(`  Unique correlations:   ${data.uniqueCorrelationIds}`);
    console.log(`  Success count:         ${data.successCount}`);
    console.log(`  Failure count:         ${data.failureCount}`);
    console.log(`  Has more pages:        ${data.hasMore}`);
    for (const e of data.events) {
      console.log(
        `  [${e.correlationId}] ${e.eventType} / ${e.eventStatus} — ${e.summary.slice(0, 60)}...`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Section 7 — Batch Summary
// ---------------------------------------------------------------------------

async function queryBatchSummary() {
  section("Section 7: Batch Summary");

  const data = (await apiCall("GET", `/events/batch/${BATCH_ID}/summary`)) as {
    batchId: string;
    totalProcesses: number;
    completed: number;
    inProgress: number;
    failed: number;
    correlationIds: string[];
    startedAt: string | null;
    lastEventAt: string | null;
  };

  if (data) {
    console.log("\n--- Batch Summary ---");
    console.log(`  Batch ID:          ${data.batchId}`);
    console.log(`  Total processes:   ${data.totalProcesses}`);
    console.log(`  Completed:         ${data.completed}`);
    console.log(`  In progress:       ${data.inProgress}`);
    console.log(`  Failed:            ${data.failed}`);
    console.log(`  Correlation IDs:   ${data.correlationIds?.join(", ")}`);
    console.log(`  Started at:        ${data.startedAt}`);
    console.log(`  Last event at:     ${data.lastEventAt}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Employee Card Origination — Event Log API Example");
  console.log(`Base URL: ${BASE_URL}`);

  try {
    await singleEmployeeOrigination();
  } catch (err) {
    console.error("Section 1 failed:", err);
  }

  try {
    await createCorrelationLink();
  } catch (err) {
    console.error("Section 2 failed:", err);
  }

  try {
    await queryByCorrelation();
  } catch (err) {
    console.error("Section 3 failed:", err);
  }

  try {
    await queryByTrace();
  } catch (err) {
    console.error("Section 4 failed:", err);
  }

  try {
    await batchUpload();
  } catch (err) {
    console.error("Section 5 failed:", err);
  }

  try {
    await queryBatchEvents();
  } catch (err) {
    console.error("Section 6 failed:", err);
  }

  try {
    await queryBatchSummary();
  } catch (err) {
    console.error("Section 7 failed:", err);
  }

  console.log("\n" + "=".repeat(70));
  console.log("  Done! Check Swagger UI at http://localhost:8080/docs");
  console.log("=".repeat(70));
}

async function clearDatabase() {
  section("Clearing Database");
  await apiCall("POST", "/debug/events/clear", { confirm: true });
}

// clearDatabase();
main();
