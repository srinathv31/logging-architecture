// ============================================================================
// EVENT LOG SDK - MAIN EXPORTS
// Version 1.4
// ============================================================================

// Models and Types
export {
  EventType,
  EventStatus,
  HttpMethod,
  type EventIdentifiers,
  type EventLogEntry,
  type EventLogRecord,
  type EventLogClientConfig,
  type CreateEventResponse,
  type BatchCreateEventResponse,
  type GetEventsByAccountResponse,
  type GetEventsByAccountParams,
  type GetEventsByCorrelationResponse,
  type GetEventsByTraceResponse,
  type BatchSummaryResponse,
  type CreateCorrelationLinkResponse,
  type GetEventsByBatchParams,
} from './models/types';

// Client
export { EventLogClient, EventLogError } from './client/EventLogClient';
export { 
  AsyncEventLogger, 
  type AsyncEventLoggerConfig, 
  type AsyncEventLoggerMetrics 
} from './client/AsyncEventLogger';
export {
  type TokenProvider,
  OAuthTokenProvider,
  type OAuthTokenProviderConfig,
  StaticTokenProvider,
  OAuthError,
  createStaticTokenProvider,
} from './client/TokenProvider';

// Utilities
export {
  createCorrelationId,
  createBatchId,
  createTraceId,
  createSpanId,
  createProcessStartEvent,
  createStepEvent,
  createProcessEndEvent,
  createErrorEvent,
  generateSummary,
  maskLast4,
  validateEvent,
} from './utils/helpers';
