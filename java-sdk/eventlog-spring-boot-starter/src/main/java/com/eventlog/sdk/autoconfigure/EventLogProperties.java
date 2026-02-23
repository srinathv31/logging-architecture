package com.eventlog.sdk.autoconfigure;

import jakarta.validation.constraints.AssertTrue;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.NestedConfigurationProperty;
import org.springframework.validation.annotation.Validated;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

@ConfigurationProperties(prefix = "eventlog")
@Validated
public class EventLogProperties {

    private static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration DEFAULT_REQUEST_TIMEOUT = Duration.ofSeconds(30);
    private static final int DEFAULT_MAX_RETRIES = 3;
    private static final Duration DEFAULT_RETRY_DELAY = Duration.ofMillis(500);

    private final boolean enabled;
    private final String baseUrl;
    private final String applicationId;
    private final Duration connectTimeout;
    private final Duration requestTimeout;
    private final int maxRetries;
    private final Duration retryDelay;
    private final String apiKey;
    private final String transport;

    @NestedConfigurationProperty
    private final OAuth oauth;

    @NestedConfigurationProperty
    private final Async async;

    @NestedConfigurationProperty
    private final MdcFilter mdcFilter;

    @NestedConfigurationProperty
    private final Metrics metrics;

    public EventLogProperties(
            Boolean enabled,
            String baseUrl,
            String applicationId,
            Duration connectTimeout,
            Duration requestTimeout,
            Integer maxRetries,
            Duration retryDelay,
            String apiKey,
            String transport,
            OAuth oauth,
            Async async,
            MdcFilter mdcFilter,
            Metrics metrics) {
        this.enabled = enabled != null && enabled;
        this.baseUrl = baseUrl;
        this.applicationId = applicationId;
        this.connectTimeout = connectTimeout != null ? connectTimeout : DEFAULT_CONNECT_TIMEOUT;
        this.requestTimeout = requestTimeout != null ? requestTimeout : DEFAULT_REQUEST_TIMEOUT;
        this.maxRetries = maxRetries != null ? maxRetries : DEFAULT_MAX_RETRIES;
        this.retryDelay = retryDelay != null ? retryDelay : DEFAULT_RETRY_DELAY;
        this.apiKey = apiKey;
        this.transport = normalizeTransport(transport);
        this.oauth = oauth != null ? oauth : new OAuth(null, null, null, null, null, null, null);
        this.async = async != null ? async : new Async(null, null, null, null, null, null, null, null, null, null, null, null, null);
        this.mdcFilter = mdcFilter != null ? mdcFilter : new MdcFilter(null, null, null, null, null, null);
        this.metrics = metrics != null ? metrics : new Metrics(null);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public String getApplicationId() {
        return applicationId;
    }

    public Duration getConnectTimeout() {
        return connectTimeout;
    }

    public Duration getRequestTimeout() {
        return requestTimeout;
    }

    public int getMaxRetries() {
        return maxRetries;
    }

    public Duration getRetryDelay() {
        return retryDelay;
    }

    public String getApiKey() {
        return apiKey;
    }

    public String getTransport() {
        return transport;
    }

    public OAuth getOauth() {
        return oauth;
    }

    public Async getAsync() {
        return async;
    }

    public MdcFilter getMdcFilter() {
        return mdcFilter;
    }

    public Metrics getMetrics() {
        return metrics;
    }

    @AssertTrue(message = "eventlog.base-url is required when eventlog.enabled=true")
    public boolean isBaseUrlValid() {
        return !enabled || hasText(baseUrl);
    }

    @AssertTrue(message = "eventlog.oauth requires token-url, client-id, and client-secret when any oauth field is set")
    public boolean isOAuthValid() {
        if (!enabled) {
            return true;
        }
        boolean anyOauth = hasText(oauth.tokenUrl) || hasText(oauth.clientId) || hasText(oauth.clientSecret);
        if (!anyOauth) {
            return true;
        }
        return hasText(oauth.tokenUrl) && hasText(oauth.clientId) && hasText(oauth.clientSecret);
    }

    @AssertTrue(message = "eventlog.transport must be one of: webclient, restclient, jdk")
    public boolean isTransportValid() {
        if (!hasText(transport)) {
            return true;
        }
        String value = transport.toLowerCase(Locale.ROOT);
        return value.equals("webclient") || value.equals("restclient") || value.equals("jdk");
    }

    public static class OAuth {
        private static final Duration DEFAULT_REFRESH_BUFFER = Duration.ofSeconds(60);
        private static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(10);
        private static final Duration DEFAULT_REQUEST_TIMEOUT = Duration.ofSeconds(30);

        private final String tokenUrl;
        private final String clientId;
        private final String clientSecret;
        private final String scope;
        private final Duration refreshBuffer;
        private final Duration connectTimeout;
        private final Duration requestTimeout;

        public OAuth(
                String tokenUrl,
                String clientId,
                String clientSecret,
                String scope,
                Duration refreshBuffer,
                Duration connectTimeout,
                Duration requestTimeout) {
            this.tokenUrl = tokenUrl;
            this.clientId = clientId;
            this.clientSecret = clientSecret;
            this.scope = scope;
            this.refreshBuffer = refreshBuffer != null ? refreshBuffer : DEFAULT_REFRESH_BUFFER;
            this.connectTimeout = connectTimeout != null ? connectTimeout : DEFAULT_CONNECT_TIMEOUT;
            this.requestTimeout = requestTimeout != null ? requestTimeout : DEFAULT_REQUEST_TIMEOUT;
        }

        public String getTokenUrl() {
            return tokenUrl;
        }

        public String getClientId() {
            return clientId;
        }

        public String getClientSecret() {
            return clientSecret;
        }

        public String getScope() {
            return scope;
        }

        public Duration getRefreshBuffer() {
            return refreshBuffer;
        }

        public Duration getConnectTimeout() {
            return connectTimeout;
        }

        public Duration getRequestTimeout() {
            return requestTimeout;
        }
    }

    public static class Async {
        private static final int DEFAULT_QUEUE_CAPACITY = 10_000;
        private static final int DEFAULT_MAX_RETRIES = 3;
        private static final long DEFAULT_BASE_RETRY_DELAY_MS = 1000;
        private static final long DEFAULT_MAX_RETRY_DELAY_MS = 30_000;
        private static final int DEFAULT_CIRCUIT_BREAKER_THRESHOLD = 5;
        private static final long DEFAULT_CIRCUIT_BREAKER_RESET_MS = 30_000;

        private final boolean enabled;
        private final int queueCapacity;
        private final int maxRetries;
        private final long baseRetryDelayMs;
        private final long maxRetryDelayMs;
        private final int circuitBreakerThreshold;
        private final long circuitBreakerResetMs;
        private final Path spilloverPath;
        private final boolean virtualThreads;
        private final String executor;
        private final int batchSize;
        private final int senderThreads;
        private final long maxBatchWaitMs;

        public Async(
                Boolean enabled,
                Integer queueCapacity,
                Integer maxRetries,
                Long baseRetryDelayMs,
                Long maxRetryDelayMs,
                Integer circuitBreakerThreshold,
                Long circuitBreakerResetMs,
                Path spilloverPath,
                Boolean virtualThreads,
                String executor,
                Integer batchSize,
                Integer senderThreads,
                Long maxBatchWaitMs) {
            this.enabled = enabled == null || enabled;
            this.queueCapacity = queueCapacity != null ? queueCapacity : DEFAULT_QUEUE_CAPACITY;
            this.maxRetries = maxRetries != null ? maxRetries : DEFAULT_MAX_RETRIES;
            this.baseRetryDelayMs = baseRetryDelayMs != null ? baseRetryDelayMs : DEFAULT_BASE_RETRY_DELAY_MS;
            this.maxRetryDelayMs = maxRetryDelayMs != null ? maxRetryDelayMs : DEFAULT_MAX_RETRY_DELAY_MS;
            this.circuitBreakerThreshold = circuitBreakerThreshold != null ? circuitBreakerThreshold : DEFAULT_CIRCUIT_BREAKER_THRESHOLD;
            this.circuitBreakerResetMs = circuitBreakerResetMs != null ? circuitBreakerResetMs : DEFAULT_CIRCUIT_BREAKER_RESET_MS;
            this.spilloverPath = spilloverPath;
            this.virtualThreads = virtualThreads != null && virtualThreads;
            this.executor = hasText(executor) ? executor.trim() : null;
            this.batchSize = batchSize != null ? batchSize : 50;
            this.senderThreads = senderThreads != null ? senderThreads : 1;
            this.maxBatchWaitMs = maxBatchWaitMs != null ? maxBatchWaitMs : 100;
        }

        public boolean isEnabled() {
            return enabled;
        }

        public int getQueueCapacity() {
            return queueCapacity;
        }

        public int getMaxRetries() {
            return maxRetries;
        }

        public long getBaseRetryDelayMs() {
            return baseRetryDelayMs;
        }

        public long getMaxRetryDelayMs() {
            return maxRetryDelayMs;
        }

        public int getCircuitBreakerThreshold() {
            return circuitBreakerThreshold;
        }

        public long getCircuitBreakerResetMs() {
            return circuitBreakerResetMs;
        }

        public Path getSpilloverPath() {
            return spilloverPath;
        }

        public boolean isVirtualThreads() {
            return virtualThreads;
        }

        public String getExecutor() {
            return executor;
        }

        public int getBatchSize() {
            return batchSize;
        }

        public int getSenderThreads() {
            return senderThreads;
        }

        public long getMaxBatchWaitMs() {
            return maxBatchWaitMs;
        }
    }

    public static class MdcFilter {
        private final boolean enabled;
        private final List<String> urlPatterns;
        private final int order;
        private final String correlationHeader;
        private final String traceHeader;
        private final String spanHeader;

        public MdcFilter(
                Boolean enabled,
                List<String> urlPatterns,
                Integer order,
                String correlationHeader,
                String traceHeader,
                String spanHeader) {
            this.enabled = enabled == null || enabled;
            this.urlPatterns = urlPatterns != null ? urlPatterns : List.of("/*");
            this.order = order != null ? order : 1;
            this.correlationHeader = hasText(correlationHeader) ? correlationHeader : "X-Correlation-Id";
            this.traceHeader = hasText(traceHeader) ? traceHeader : "X-Trace-Id";
            this.spanHeader = hasText(spanHeader) ? spanHeader : "X-Span-Id";
        }

        public boolean isEnabled() {
            return enabled;
        }

        public List<String> getUrlPatterns() {
            return urlPatterns;
        }

        public int getOrder() {
            return order;
        }

        public String getCorrelationHeader() {
            return correlationHeader;
        }

        public String getTraceHeader() {
            return traceHeader;
        }

        public String getSpanHeader() {
            return spanHeader;
        }
    }

    public static class Metrics {
        private final boolean enabled;

        public Metrics(Boolean enabled) {
            this.enabled = enabled == null || enabled;
        }

        public boolean isEnabled() {
            return enabled;
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String normalizeTransport(String transport) {
        if (!hasText(transport)) {
            return null;
        }
        return transport.trim().toLowerCase(Locale.ROOT);
    }
}
