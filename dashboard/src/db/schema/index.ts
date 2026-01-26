export { eventLogs } from './event-logs';
export { correlationLinks } from './correlation-links';
export { processDefinitions } from './process-definitions';
export { accountTimelineSummary } from './account-timeline-summary';

import type { InferSelectModel } from 'drizzle-orm';
import type { eventLogs } from './event-logs';

export type EventLog = InferSelectModel<typeof eventLogs>;
