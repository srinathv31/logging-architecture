export { eventLogs } from './event-logs';
export { correlationLinks } from './correlation-links';
export { processDefinitions } from './process-definitions';
export { accountTimelineSummary } from './account-timeline-summary';

// Inferred types
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { eventLogs } from './event-logs';
import type { correlationLinks } from './correlation-links';
import type { processDefinitions } from './process-definitions';
import type { accountTimelineSummary } from './account-timeline-summary';

export type EventLog = InferSelectModel<typeof eventLogs>;
export type NewEventLog = InferInsertModel<typeof eventLogs>;

export type CorrelationLink = InferSelectModel<typeof correlationLinks>;
export type NewCorrelationLink = InferInsertModel<typeof correlationLinks>;

export type ProcessDefinition = InferSelectModel<typeof processDefinitions>;
export type NewProcessDefinition = InferInsertModel<typeof processDefinitions>;

export type AccountTimelineSummary = InferSelectModel<typeof accountTimelineSummary>;
export type NewAccountTimelineSummary = InferInsertModel<typeof accountTimelineSummary>;
