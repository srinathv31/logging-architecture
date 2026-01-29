export { eventLogs } from './event-logs';
export { correlationLinks } from './correlation-links';
export { processDefinitions } from './process-definitions';
export { accountTimelineSummary } from './account-timeline-summary';

// Inferred types using MsSql-specific types
import type { eventLogs } from './event-logs';
import type { correlationLinks } from './correlation-links';
import type { processDefinitions } from './process-definitions';
import type { accountTimelineSummary } from './account-timeline-summary';

// Type inference for MSSQL tables
type InferSelect<T> = T extends { $inferSelect: infer S } ? S : never;
type InferInsert<T> = T extends { $inferInsert: infer I } ? I : never;

export type EventLog = InferSelect<typeof eventLogs>;
export type NewEventLog = InferInsert<typeof eventLogs>;

export type CorrelationLink = InferSelect<typeof correlationLinks>;
export type NewCorrelationLink = InferInsert<typeof correlationLinks>;

export type ProcessDefinition = InferSelect<typeof processDefinitions>;
export type NewProcessDefinition = InferInsert<typeof processDefinitions>;

export type AccountTimelineSummary = InferSelect<typeof accountTimelineSummary>;
export type NewAccountTimelineSummary = InferInsert<typeof accountTimelineSummary>;
