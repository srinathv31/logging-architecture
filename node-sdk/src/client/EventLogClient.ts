// ============================================================================
// EVENT LOG SDK - CLIENT
// ============================================================================

import {
  EventLogEntry,
  EventLogClientConfig,
  CreateEventResponse,
  BatchCreateEventResponse,
  GetEventsByAccountResponse,
  GetEventsByAccountParams,
  GetEventsByCorrelationResponse,
  GetEventsByTraceResponse,
  BatchSummaryResponse,
  CreateCorrelationLinkResponse,
  GetEventsByBatchParams,
} from '../models/types';
import { TokenProvider, StaticTokenProvider } from './TokenProvider';

/**
 * Custom error class for Event Log API errors
 */
export class EventLogError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'EventLogError';
  }
}

/**
 * Event Log API Client
 * 
 * @example OAuth (Recommended for Production)
 * ```typescript
 * import { EventLogClient, OAuthTokenProvider } from '@yourcompany/eventlog-sdk';
 * 
 * const tokenProvider = new OAuthTokenProvider({
 *   tokenUrl: 'https://auth.yourcompany.com/oauth/token',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   scope: 'eventlog:write eventlog:read',
 * });
 * 
 * const client = new EventLogClient({
 *   baseUrl: 'https://eventlog-api.yourcompany.com',
 *   tokenProvider,
 * });
 * ```
 * 
 * @example API Key (Development/Testing)
 * ```typescript
 * const client = new EventLogClient({
 *   baseUrl: 'https://eventlog-api.yourcompany.com',
 *   apiKey: 'your-api-key',
 * });
 * ```
 */
export class EventLogClient {
  private readonly baseUrl: string;
  private readonly staticHeaders: Record<string, string>;
  private readonly tokenProvider?: TokenProvider;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: EventLogClientConfig) {
    if (!config.baseUrl) {
      throw new Error('baseUrl is required');
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.fetchFn = config.fetch ?? fetch;

    this.staticHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (config.applicationId) {
      this.staticHeaders['X-Application-Id'] = config.applicationId;
    }

    // Set up token provider
    if (config.tokenProvider) {
      this.tokenProvider = config.tokenProvider;
    } else if (config.apiKey) {
      // Convenience: wrap API key in static provider
      this.tokenProvider = new StaticTokenProvider(config.apiKey);
    }
  }

  // ==========================================================================
  // Event Operations
  // ==========================================================================

  /**
   * Create a single event
   */
  async createEvent(event: EventLogEntry): Promise<CreateEventResponse> {
    return this.post<CreateEventResponse>('/api/v1/events', { events: event });
  }

  /**
   * Create multiple events in a batch
   */
  async createEvents(events: EventLogEntry[]): Promise<BatchCreateEventResponse> {
    return this.post<BatchCreateEventResponse>('/api/v1/events/batch', { events });
  }

  /**
   * Get events by account ID
   */
  async getEventsByAccount(
    accountId: string,
    params?: GetEventsByAccountParams
  ): Promise<GetEventsByAccountResponse> {
    const queryString = this.buildQueryString(params);
    return this.get<GetEventsByAccountResponse>(
      `/api/v1/events/account/${encodeURIComponent(accountId)}${queryString}`
    );
  }

  /**
   * Get events by correlation ID
   */
  async getEventsByCorrelation(
    correlationId: string
  ): Promise<GetEventsByCorrelationResponse> {
    return this.get<GetEventsByCorrelationResponse>(
      `/api/v1/events/correlation/${encodeURIComponent(correlationId)}`
    );
  }

  /**
   * Get events by trace ID
   */
  async getEventsByTrace(traceId: string): Promise<GetEventsByTraceResponse> {
    return this.get<GetEventsByTraceResponse>(
      `/api/v1/events/trace/${encodeURIComponent(traceId)}`
    );
  }

  /**
   * Get events by batch ID
   */
  async getEventsByBatch(
    batchId: string,
    params?: GetEventsByBatchParams
  ): Promise<GetEventsByAccountResponse> {
    const queryString = this.buildQueryString(params);
    return this.get<GetEventsByAccountResponse>(
      `/api/v1/events/batch/${encodeURIComponent(batchId)}${queryString}`
    );
  }

  /**
   * Get batch summary statistics
   */
  async getBatchSummary(batchId: string): Promise<BatchSummaryResponse> {
    return this.get<BatchSummaryResponse>(
      `/api/v1/events/batch/${encodeURIComponent(batchId)}/summary`
    );
  }

  // ==========================================================================
  // Correlation Link Operations
  // ==========================================================================

  /**
   * Create a correlation link
   */
  async createCorrelationLink(params: {
    correlation_id: string;
    account_id: string;
    application_id?: string;
    customer_id?: string;
    card_number_last4?: string;
  }): Promise<CreateCorrelationLinkResponse> {
    return this.post<CreateCorrelationLinkResponse>(
      '/api/v1/correlation-links',
      params
    );
  }

  // ==========================================================================
  // HTTP Methods
  // ==========================================================================

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff
          await this.sleep(500 * attempt);
        }

        // Build headers with auth
        const headers: Record<string, string> = { ...this.staticHeaders };
        if (this.tokenProvider) {
          const token = await this.tokenProvider.getToken();
          headers['Authorization'] = `Bearer ${token}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await this.fetchFn(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return await response.json();
        }

        const errorBody = await response.text();

        // Retry on server errors and rate limits
        if ((response.status >= 500 || response.status === 429) && attempt < this.maxRetries) {
          lastError = new EventLogError(
            `Server error: ${response.status}`,
            response.status
          );
          continue;
        }

        // Don't retry client errors
        throw new EventLogError(
          `API error: ${response.status} - ${errorBody}`,
          response.status,
          this.extractErrorCode(errorBody)
        );
      } catch (error) {
        if (error instanceof EventLogError) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt >= this.maxRetries) {
          throw new EventLogError(
            `Request failed after ${this.maxRetries} retries`,
            undefined,
            undefined,
            lastError
          );
        }
      }
    }

    throw new EventLogError(
      `Request failed after ${this.maxRetries} retries`,
      undefined,
      undefined,
      lastError
    );
  }

  private buildQueryString(params?: Record<string, unknown>): string {
    if (!params) return '';

    const filtered = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

    return filtered.length > 0 ? `?${filtered.join('&')}` : '';
  }

  private extractErrorCode(body: string): string | undefined {
    try {
      const parsed = JSON.parse(body);
      return parsed.error_code;
    } catch {
      return undefined;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
