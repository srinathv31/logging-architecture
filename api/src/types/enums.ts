export const EventType = {
  PROCESS_START: 'PROCESS_START',
  STEP: 'STEP',
  PROCESS_END: 'PROCESS_END',
  ERROR: 'ERROR',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const EVENT_TYPES = Object.values(EventType) as [EventType, ...EventType[]];

export const EventStatus = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  IN_PROGRESS: 'IN_PROGRESS',
  SKIPPED: 'SKIPPED',
} as const;

export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const EVENT_STATUSES = Object.values(EventStatus) as [EventStatus, ...EventStatus[]];

export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

export const HTTP_METHODS = Object.values(HttpMethod) as [HttpMethod, ...HttpMethod[]];
