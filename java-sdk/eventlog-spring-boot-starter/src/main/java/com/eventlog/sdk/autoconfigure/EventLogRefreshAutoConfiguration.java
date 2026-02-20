package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.autoconfigure.logging.LogEventAspect;
import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.EventLossCallback;
import com.eventlog.sdk.client.OAuthTokenProvider;
import com.eventlog.sdk.client.TokenProvider;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.template.EventLogTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestClient;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.http.HttpClient;
import java.util.concurrent.Executor;

@AutoConfiguration
@EnableConfigurationProperties(EventLogProperties.class)
@ConditionalOnClass(value = EventLogClient.class, name = "org.springframework.cloud.context.scope.refresh.RefreshScope")
@ConditionalOnExpression("${eventlog.enabled:false} and ${eventlog.refresh.enabled:true}")
public class EventLogRefreshAutoConfiguration extends EventLogAutoConfiguration {

    public EventLogRefreshAutoConfiguration(Environment environment) {
        super(environment);
    }

    @Bean
    @Scope("refresh")
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "eventlog.oauth", name = {"token-url", "client-id", "client-secret"})
    @Override
    public OAuthTokenProvider oauthTokenProvider(
            EventLogProperties properties,
            ObjectProvider<ObjectMapper> objectMapperProvider,
            ObjectProvider<HttpClient> httpClientProvider) {
        return super.oauthTokenProvider(properties, objectMapperProvider, httpClientProvider);
    }

    @Bean
    @Scope("refresh")
    @ConditionalOnClass(WebClient.class)
    @ConditionalOnProperty(prefix = "eventlog", name = "transport", havingValue = "webclient", matchIfMissing = true)
    @ConditionalOnMissingBean(EventLogTransport.class)
    @Override
    public EventLogTransport eventLogWebClientTransport(ObjectProvider<WebClient.Builder> webClientBuilderProvider) {
        return super.eventLogWebClientTransport(webClientBuilderProvider);
    }

    @Bean
    @Scope("refresh")
    @ConditionalOnClass(RestClient.class)
    @ConditionalOnProperty(prefix = "eventlog", name = "transport", havingValue = "restclient", matchIfMissing = true)
    @ConditionalOnMissingBean(EventLogTransport.class)
    @Override
    public EventLogTransport eventLogRestClientTransport(
            ObjectProvider<RestClient.Builder> restClientBuilderProvider,
            ObjectProvider<Executor> asyncExecutorProvider) {
        return super.eventLogRestClientTransport(restClientBuilderProvider, asyncExecutorProvider);
    }

    @Bean
    @Scope("refresh")
    @ConditionalOnProperty(prefix = "eventlog", name = "transport", havingValue = "jdk", matchIfMissing = true)
    @ConditionalOnMissingBean(EventLogTransport.class)
    @Override
    public EventLogTransport eventLogJdkTransport(ObjectProvider<HttpClient> httpClientProvider) {
        return super.eventLogJdkTransport(httpClientProvider);
    }

    @Bean
    @Scope("refresh")
    @ConditionalOnMissingBean(TokenProvider.class)
    @ConditionalOnProperty(prefix = "eventlog", name = "api-key")
    @Override
    public TokenProvider apiKeyTokenProvider(EventLogProperties properties) {
        return super.apiKeyTokenProvider(properties);
    }

    @Bean
    @Scope("refresh")
    @ConditionalOnMissingBean
    @Override
    public EventLogClient eventLogClient(
            EventLogProperties properties,
            ObjectProvider<TokenProvider> tokenProvider,
            ObjectProvider<ObjectMapper> objectMapperProvider,
            ObjectProvider<HttpClient> httpClientProvider,
            ObjectProvider<Executor> asyncExecutorProvider,
            ObjectProvider<EventLogTransport> transportProvider) {
        return super.eventLogClient(properties, tokenProvider, objectMapperProvider, httpClientProvider, asyncExecutorProvider, transportProvider);
    }

    @Bean(destroyMethod = "shutdown")
    @Scope("refresh")
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "eventlog.async", name = "enabled", havingValue = "true", matchIfMissing = true)
    @Override
    public AsyncEventLogger asyncEventLogger(
            EventLogClient client,
            EventLogProperties properties,
            ObjectProvider<ThreadPoolTaskExecutor> taskExecutorProvider,
            ObjectProvider<TaskScheduler> taskSchedulerProvider,
            ObjectProvider<EventLossCallback> eventLossCallbackProvider,
            ApplicationContext applicationContext) {
        return super.asyncEventLogger(client, properties, taskExecutorProvider, taskSchedulerProvider, eventLossCallbackProvider, applicationContext);
    }

    @Bean
    @Scope("refresh")
    @ConditionalOnBean(AsyncEventLogger.class)
    @ConditionalOnClass(Aspect.class)
    @ConditionalOnProperty(prefix = "eventlog.annotation", name = "enabled", havingValue = "true", matchIfMissing = true)
    @Override
    public LogEventAspect logEventAspect(AsyncEventLogger asyncEventLogger, EventLogProperties properties) {
        return super.logEventAspect(asyncEventLogger, properties);
    }

    @Bean
    @Scope("refresh")
    @ConditionalOnBean(AsyncEventLogger.class)
    @ConditionalOnMissingBean
    @ConditionalOnExpression(
            "T(org.springframework.util.StringUtils).hasText('${eventlog.application-id:}') || " +
            "T(org.springframework.util.StringUtils).hasText('${spring.application.name:}') || " +
            "T(org.springframework.util.StringUtils).hasText('${eventlog.target-system:}') || " +
            "T(org.springframework.util.StringUtils).hasText('${eventlog.originating-system:}')")
    @Override
    public EventLogTemplate eventLogTemplate(EventLogProperties properties, AsyncEventLogger asyncEventLogger) {
        return super.eventLogTemplate(properties, asyncEventLogger);
    }
}
