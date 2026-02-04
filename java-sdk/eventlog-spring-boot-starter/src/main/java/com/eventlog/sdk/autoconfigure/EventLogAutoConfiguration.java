package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.OAuthTokenProvider;
import com.eventlog.sdk.client.TokenProvider;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.autoconfigure.logging.LogEventAspect;
import com.eventlog.sdk.autoconfigure.transport.RestClientTransport;
import com.eventlog.sdk.autoconfigure.transport.WebClientTransport;
import com.eventlog.sdk.template.EventLogTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Conditional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ConcurrentTaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.client.RestClient;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ExecutorService;

@AutoConfiguration
@EnableConfigurationProperties(EventLogProperties.class)
@ConditionalOnClass(EventLogClient.class)
@ConditionalOnProperty(prefix = "eventlog", name = "enabled", havingValue = "true")
@Conditional(EventLogBaseAutoConfigurationCondition.class)
public class EventLogAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(EventLogAutoConfiguration.class);
    private static final Set<String> DEV_PROFILES = new HashSet<>(Arrays.asList("dev", "local", "test"));

    private static final Duration DEV_CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration DEV_REQUEST_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration DEV_RETRY_DELAY = Duration.ofMillis(200);
    private static final long DEV_ASYNC_BASE_RETRY_DELAY_MS = 500;
    private static final long DEV_ASYNC_MAX_RETRY_DELAY_MS = 5_000;

    private final Environment environment;

    public EventLogAutoConfiguration(Environment environment) {
        this.environment = environment;
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "eventlog.oauth", name = {"token-url", "client-id", "client-secret"})
    public OAuthTokenProvider oauthTokenProvider(
            EventLogProperties properties,
            ObjectProvider<ObjectMapper> objectMapperProvider,
            ObjectProvider<HttpClient> httpClientProvider) {
        EventLogProperties.OAuth oauth = properties.getOauth();
        Duration oauthConnectTimeout = resolveDuration(
                oauth.getConnectTimeout(),
                "eventlog.oauth.connect-timeout",
                DEV_CONNECT_TIMEOUT);
        Duration oauthRequestTimeout = resolveDuration(
                oauth.getRequestTimeout(),
                "eventlog.oauth.request-timeout",
                DEV_REQUEST_TIMEOUT);

        OAuthTokenProvider.Builder builder = OAuthTokenProvider.builder()
                .tokenUrl(oauth.getTokenUrl())
                .clientId(oauth.getClientId())
                .clientSecret(oauth.getClientSecret())
                .scope(oauth.getScope())
                .refreshBuffer(oauth.getRefreshBuffer())
                .connectTimeout(oauthConnectTimeout)
                .requestTimeout(oauthRequestTimeout);

        ObjectMapper objectMapper = objectMapperProvider.getIfUnique();
        if (objectMapper != null) {
            builder.objectMapper(objectMapper);
        }

        HttpClient httpClient = httpClientProvider.getIfUnique();
        if (httpClient != null) {
            builder.httpClient(httpClient);
        }

        return builder.build();
    }

    @Bean
    @ConditionalOnClass(WebClient.class)
    @ConditionalOnProperty(prefix = "eventlog", name = "transport", havingValue = "webclient", matchIfMissing = true)
    @ConditionalOnMissingBean(EventLogTransport.class)
    public EventLogTransport eventLogWebClientTransport(
            ObjectProvider<WebClient.Builder> webClientBuilderProvider) {
        WebClient.Builder builder = webClientBuilderProvider.getIfUnique();
        WebClient webClient = builder != null ? builder.build() : WebClient.builder().build();
        return new WebClientTransport(webClient);
    }

    @Bean
    @ConditionalOnClass(RestClient.class)
    @ConditionalOnProperty(prefix = "eventlog", name = "transport", havingValue = "restclient", matchIfMissing = true)
    @ConditionalOnMissingBean(EventLogTransport.class)
    public EventLogTransport eventLogRestClientTransport(
            ObjectProvider<RestClient.Builder> restClientBuilderProvider,
            ObjectProvider<Executor> asyncExecutorProvider) {
        RestClient.Builder builder = restClientBuilderProvider.getIfUnique();
        RestClient restClient = builder != null ? builder.build() : RestClient.builder().build();
        return new RestClientTransport(restClient, asyncExecutorProvider.getIfUnique());
    }

    @Bean
    @ConditionalOnProperty(prefix = "eventlog", name = "transport", havingValue = "jdk", matchIfMissing = true)
    @ConditionalOnMissingBean(EventLogTransport.class)
    public EventLogTransport eventLogJdkTransport(ObjectProvider<HttpClient> httpClientProvider) {
        HttpClient httpClient = httpClientProvider.getIfUnique();
        if (httpClient == null) {
            httpClient = HttpClient.newBuilder().build();
        }
        return new com.eventlog.sdk.client.transport.JdkHttpTransport(httpClient);
    }

    @Bean
    @ConditionalOnMissingBean(TokenProvider.class)
    @ConditionalOnProperty(prefix = "eventlog", name = "api-key")
    public TokenProvider apiKeyTokenProvider(EventLogProperties properties) {
        return TokenProvider.of(properties.getApiKey());
    }

    @Bean
    @ConditionalOnMissingBean
    public EventLogClient eventLogClient(
            EventLogProperties properties,
            ObjectProvider<TokenProvider> tokenProvider,
            ObjectProvider<ObjectMapper> objectMapperProvider,
            ObjectProvider<HttpClient> httpClientProvider,
            ObjectProvider<Executor> asyncExecutorProvider,
            ObjectProvider<EventLogTransport> transportProvider) {
        Duration connectTimeout = resolveDuration(
                properties.getConnectTimeout(),
                "eventlog.connect-timeout",
                DEV_CONNECT_TIMEOUT);
        Duration requestTimeout = resolveDuration(
                properties.getRequestTimeout(),
                "eventlog.request-timeout",
                DEV_REQUEST_TIMEOUT);
        Duration retryDelay = resolveDuration(
                properties.getRetryDelay(),
                "eventlog.retry-delay",
                DEV_RETRY_DELAY);

        EventLogClient.Builder builder = EventLogClient.builder()
                .baseUrl(properties.getBaseUrl())
                .connectTimeout(connectTimeout)
                .requestTimeout(requestTimeout)
                .maxRetries(properties.getMaxRetries())
                .retryDelay(retryDelay);

        if (properties.getApplicationId() != null && !properties.getApplicationId().isBlank()) {
            builder.applicationId(properties.getApplicationId());
        }

        TokenProvider token = tokenProvider.getIfUnique();
        if (token != null) {
            builder.tokenProvider(token);
        }

        ObjectMapper objectMapper = objectMapperProvider.getIfUnique();
        if (objectMapper != null) {
            builder.objectMapper(objectMapper);
        }

        HttpClient httpClient = httpClientProvider.getIfUnique();
        if (httpClient != null) {
            builder.httpClient(httpClient);
        }

        Executor asyncExecutor = asyncExecutorProvider.getIfUnique();
        if (asyncExecutor != null) {
            builder.asyncExecutor(asyncExecutor);
        }

        EventLogTransport transport = transportProvider.getIfUnique();
        if (transport != null) {
            builder.transport(transport);
        }

        return builder.build();
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "eventlog.async", name = "enabled", havingValue = "true", matchIfMissing = true)
    public AsyncEventLogger asyncEventLogger(
            EventLogClient client,
            EventLogProperties properties,
            ObjectProvider<ThreadPoolTaskExecutor> taskExecutorProvider,
            ObjectProvider<TaskScheduler> taskSchedulerProvider,
            ApplicationContext applicationContext) {
        EventLogProperties.Async async = properties.getAsync();
        long baseRetryDelayMs = resolveLong(
                async.getBaseRetryDelayMs(),
                "eventlog.async.base-retry-delay-ms",
                DEV_ASYNC_BASE_RETRY_DELAY_MS);
        long maxRetryDelayMs = resolveLong(
                async.getMaxRetryDelayMs(),
                "eventlog.async.max-retry-delay-ms",
                DEV_ASYNC_MAX_RETRY_DELAY_MS);

        ResolvedExecutors resolvedExecutors = resolveAsyncExecutors(
                async,
                taskExecutorProvider,
                taskSchedulerProvider,
                applicationContext);

        AsyncEventLogger.Builder builder = AsyncEventLogger.builder()
                .client(client)
                .queueCapacity(async.getQueueCapacity())
                .maxRetries(async.getMaxRetries())
                .baseRetryDelayMs(baseRetryDelayMs)
                .maxRetryDelayMs(maxRetryDelayMs)
                .circuitBreakerThreshold(async.getCircuitBreakerThreshold())
                .circuitBreakerResetMs(async.getCircuitBreakerResetMs())
                .registerShutdownHook(false)
                .virtualThreads(resolvedExecutors.virtualThreads);

        if (resolvedExecutors.senderExecutor != null) {
            builder.senderExecutor(resolvedExecutors.senderExecutor);
        }

        if (resolvedExecutors.retryExecutor != null) {
            builder.retryExecutor(resolvedExecutors.retryExecutor);
        }

        if (async.getSpilloverPath() != null) {
            builder.spilloverPath(async.getSpilloverPath());
        }

        return builder.build();
    }

    @Bean
    @ConditionalOnBean(AsyncEventLogger.class)
    public EventLogShutdown eventLogShutdown(AsyncEventLogger asyncEventLogger) {
        return new EventLogShutdown(asyncEventLogger);
    }

    @Bean
    @ConditionalOnBean(AsyncEventLogger.class)
    @ConditionalOnClass(Aspect.class)
    @ConditionalOnProperty(prefix = "eventlog.annotation", name = "enabled", havingValue = "true", matchIfMissing = true)
    public LogEventAspect logEventAspect(AsyncEventLogger asyncEventLogger, EventLogProperties properties) {
        return LogEventAspect.from(environment, properties, asyncEventLogger);
    }

    @Bean
    @ConditionalOnBean(AsyncEventLogger.class)
    @ConditionalOnMissingBean
    @ConditionalOnExpression(
            "T(org.springframework.util.StringUtils).hasText('${eventlog.application-id:}') || " +
            "T(org.springframework.util.StringUtils).hasText('${spring.application.name:}') || " +
            "T(org.springframework.util.StringUtils).hasText('${eventlog.target-system:}') || " +
            "T(org.springframework.util.StringUtils).hasText('${eventlog.originating-system:}')")
    public EventLogTemplate eventLogTemplate(EventLogProperties properties, AsyncEventLogger asyncEventLogger) {
        ResolvedDefaults resolved = resolveDefaults(properties);
        return EventLogTemplate.builder(asyncEventLogger)
                .applicationId(resolved.applicationId)
                .targetSystem(resolved.targetSystem)
                .originatingSystem(resolved.originatingSystem)
                .build();
    }

    private ResolvedExecutors resolveAsyncExecutors(
            EventLogProperties.Async async,
            ObjectProvider<ThreadPoolTaskExecutor> taskExecutorProvider,
            ObjectProvider<TaskScheduler> taskSchedulerProvider,
            ApplicationContext applicationContext) {
        String executorConfig = async.getExecutor();
        boolean explicitConfig = hasText(executorConfig);
        String normalized = executorConfig != null ? executorConfig.trim() : null;
        boolean forceVirtual = explicitConfig && "virtual".equalsIgnoreCase(normalized);
        boolean forceSpring = explicitConfig && "spring".equalsIgnoreCase(normalized);

        ExecutorService senderExecutor = null;
        ScheduledExecutorService retryExecutor = null;
        boolean virtualThreads = async.isVirtualThreads() || forceVirtual;

        if (explicitConfig) {
            if (forceVirtual) {
                // Virtual threads selected explicitly; allow builder to create executors.
            } else if (forceSpring) {
                ThreadPoolTaskExecutor taskExecutor = taskExecutorProvider.getIfUnique();
                if (taskExecutor != null) {
                    senderExecutor = taskExecutor.getThreadPoolExecutor();
                } else {
                    log.warn("eventlog.async.executor=spring but no ThreadPoolTaskExecutor bean found");
                }
            } else {
                if (!applicationContext.containsBean(normalized)) {
                    throw new IllegalStateException("No bean named '" + normalized + "' found for eventlog.async.executor");
                }
                Object bean = applicationContext.getBean(normalized);
                if (bean instanceof ThreadPoolTaskExecutor taskExecutor) {
                    senderExecutor = taskExecutor.getThreadPoolExecutor();
                } else if (bean instanceof ExecutorService executorService) {
                    senderExecutor = executorService;
                } else if (bean instanceof Executor) {
                    throw new IllegalStateException("Bean '" + normalized + "' must be ExecutorService or ThreadPoolTaskExecutor");
                } else {
                    throw new IllegalStateException("Bean '" + normalized + "' is not an Executor");
                }

                if (bean instanceof ScheduledExecutorService scheduledExecutorService) {
                    retryExecutor = scheduledExecutorService;
                } else if (bean instanceof ThreadPoolTaskScheduler scheduler) {
                    retryExecutor = scheduler.getScheduledExecutor();
                }
            }
        }

        if (senderExecutor == null && (!explicitConfig || forceSpring)) {
            ThreadPoolTaskExecutor taskExecutor = taskExecutorProvider.getIfUnique();
            if (taskExecutor != null) {
                senderExecutor = taskExecutor.getThreadPoolExecutor();
            }
        }

        if (retryExecutor == null && !forceVirtual) {
            TaskScheduler taskScheduler = taskSchedulerProvider.getIfUnique();
            if (taskScheduler instanceof ThreadPoolTaskScheduler scheduler) {
                retryExecutor = scheduler.getScheduledExecutor();
            }
        }

        return new ResolvedExecutors(senderExecutor, retryExecutor, virtualThreads);
    }

    private Duration resolveDuration(Duration currentValue, String propertyKey, Duration devDefault) {
        if (environment.containsProperty(propertyKey)) {
            return currentValue;
        }
        return isDevProfile() ? devDefault : currentValue;
    }

    private long resolveLong(long currentValue, String propertyKey, long devDefault) {
        if (environment.containsProperty(propertyKey)) {
            return currentValue;
        }
        return isDevProfile() ? devDefault : currentValue;
    }

    private boolean isDevProfile() {
        String[] activeProfiles = environment.getActiveProfiles();
        if (activeProfiles.length == 0) {
            activeProfiles = environment.getDefaultProfiles();
        }
        for (String profile : activeProfiles) {
            if (DEV_PROFILES.contains(profile.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private ResolvedDefaults resolveDefaults(EventLogProperties properties) {
        String applicationId = firstNonBlank(
                properties.getApplicationId(),
                environment.getProperty("spring.application.name"),
                environment.getProperty("eventlog.target-system"),
                environment.getProperty("eventlog.originating-system"));
        String targetSystem = firstNonBlank(environment.getProperty("eventlog.target-system"), applicationId);
        String originatingSystem = firstNonBlank(environment.getProperty("eventlog.originating-system"), applicationId);
        return new ResolvedDefaults(applicationId, targetSystem, originatingSystem);
    }

    private static String firstNonBlank(String primary, String fallback) {
        if (hasText(primary)) {
            return primary;
        }
        return hasText(fallback) ? fallback : null;
    }

    private static String firstNonBlank(String first, String second, String third, String fourth) {
        if (hasText(first)) {
            return first;
        }
        if (hasText(second)) {
            return second;
        }
        if (hasText(third)) {
            return third;
        }
        return hasText(fourth) ? fourth : null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private record ResolvedExecutors(
            ExecutorService senderExecutor,
            ScheduledExecutorService retryExecutor,
            boolean virtualThreads) {
    }

    private record ResolvedDefaults(
            String applicationId,
            String targetSystem,
            String originatingSystem) {
    }
}
