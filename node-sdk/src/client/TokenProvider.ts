// ============================================================================
// OAUTH TOKEN PROVIDER - Automatic token refresh
// ============================================================================

/**
 * Interface for providing authentication tokens
 */
export interface TokenProvider {
  /**
   * Get a valid authentication token
   * Implementations should handle caching and refresh as needed
   */
  getToken(): Promise<string>;
}

/**
 * Configuration for OAuthTokenProvider
 */
export interface OAuthTokenProviderConfig {
  /** OAuth token endpoint URL */
  tokenUrl: string;
  
  /** OAuth client ID */
  clientId: string;
  
  /** OAuth client secret */
  clientSecret: string;
  
  /** OAuth scope(s) to request */
  scope?: string;
  
  /** How early to refresh before expiry in ms (default: 60000) */
  refreshBufferMs?: number;
  
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp ms
}

/**
 * OAuth 2.0 Token Provider with automatic refresh
 * 
 * Handles OAuth client credentials flow for service-to-service authentication.
 * Automatically caches tokens and refreshes them before expiry.
 * 
 * @example
 * ```typescript
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
 */
export class OAuthTokenProvider implements TokenProvider {
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly scope?: string;
  private readonly refreshBufferMs: number;
  private readonly fetchFn: typeof fetch;

  private cachedToken: CachedToken | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(config: OAuthTokenProviderConfig) {
    if (!config.tokenUrl) throw new Error('tokenUrl is required');
    if (!config.clientId) throw new Error('clientId is required');
    if (!config.clientSecret) throw new Error('clientSecret is required');

    this.tokenUrl = config.tokenUrl;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scope = config.scope;
    this.refreshBufferMs = config.refreshBufferMs ?? 60_000;
    this.fetchFn = config.fetch ?? fetch;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getToken(): Promise<string> {
    // Check if current token is valid
    if (this.cachedToken && !this.isExpired(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    // If refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start refresh
    this.refreshPromise = this.fetchToken();
    
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Force invalidate the cached token
   */
  invalidateToken(): void {
    this.cachedToken = null;
  }

  private isExpired(token: CachedToken): boolean {
    return Date.now() + this.refreshBufferMs >= token.expiresAt;
  }

  private async fetchToken(): Promise<string> {
    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
    });
    
    if (this.scope) {
      body.append('scope', this.scope);
    }

    const response = await this.fetchFn(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new OAuthError(`Token request failed: ${response.status} - ${errorBody}`);
    }

    const data: TokenResponse = await response.json();

    if (!data.access_token) {
      throw new OAuthError('Token response missing access_token');
    }

    const expiresIn = data.expires_in ?? 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt,
    };

    console.log(`[OAuth] Token refreshed, expires in ${expiresIn} seconds`);

    return data.access_token;
  }
}

/**
 * Static token provider for API keys or testing
 */
export class StaticTokenProvider implements TokenProvider {
  private readonly token: string;

  constructor(token: string) {
    if (!token) throw new Error('token is required');
    this.token = token;
  }

  async getToken(): Promise<string> {
    return this.token;
  }
}

/**
 * Error thrown when OAuth operations fail
 */
export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthError';
  }
}

/**
 * Convenience function to create a static token provider
 */
export function createStaticTokenProvider(token: string): TokenProvider {
  return new StaticTokenProvider(token);
}
