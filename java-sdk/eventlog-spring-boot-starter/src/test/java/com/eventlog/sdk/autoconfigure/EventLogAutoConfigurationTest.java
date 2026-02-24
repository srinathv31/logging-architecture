package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.autoconfigure.logging.LogEventAspect;
import com.eventlog.sdk.autoconfigure.transport.RestClientTransport;
import com.eventlog.sdk.autoconfigure.transport.WebClientTransport;
import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.OAuthTokenProvider;
import com.eventlog.sdk.client.TokenProvider;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.template.EventLogTemplate;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EventLogAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventLogAutoConfiguration.class));

    // --- Existing tests ---

    @Test
    void doesNotRegisterBeansWhenDisabled() {
        contextRunner.run(context -> {
            assertThat(context).doesNotHaveBean(EventLogClient.class);
            assertThat(context).doesNotHaveBean(AsyncEventLogger.class);
            assertThat(context).doesNotHaveBean(EventLogTransport.class);
        });
    }

    @Test
    void registersBeansWhenEnabledAndConfigured() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://eventlog-api.example.com",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogClient.class);
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                    assertThat(context).hasSingleBean(EventLogTransport.class);
                });
    }

    // --- Transport selection ---

    @Test
    void registersJdkTransportByDefault() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogTransport.class);
                    assertThat(context.getBean(EventLogTransport.class).getClass().getSimpleName())
                            .isEqualTo("JdkHttpTransport");
                });
    }

    @Test
    void registersRestClientTransportWhenConfigured() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=restclient")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogTransport.class);
                    assertThat(context.getBean(EventLogTransport.class)).isInstanceOf(RestClientTransport.class);
                });
    }

    @Test
    void registersWebClientTransportWhenConfigured() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=webclient")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogTransport.class);
                    assertThat(context.getBean(EventLogTransport.class)).isInstanceOf(WebClientTransport.class);
                });
    }

    @Test
    void transportBeanIsSingletonRegardlessOfType() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context.getBeansOfType(EventLogTransport.class)).hasSize(1);
                });
    }

    // --- Auth ---

    @Test
    void registersApiKeyTokenProvider() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.api-key=my-secret-key")
                .run(context -> {
                    assertThat(context).hasSingleBean(TokenProvider.class);
                });
    }

    @Test
    void doesNotRegisterTokenProviderWithoutApiKey() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(TokenProvider.class);
                });
    }

    // --- Lifecycle beans ---

    @Test
    void registersShutdownBeanWithAsyncLogger() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogShutdown.class);
                });
    }

    @Test
    void registersLogEventAspect() {
        contextRunner
                .withConfiguration(AutoConfigurations.of(AopAutoConfiguration.class))
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.application-id=my-app")
                .run(context -> {
                    assertThat(context).hasSingleBean(LogEventAspect.class);
                });
    }

    @Test
    void doesNotRegisterAspectWhenDisabled() {
        contextRunner
                .withConfiguration(AutoConfigurations.of(AopAutoConfiguration.class))
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.application-id=my-app",
                        "eventlog.annotation.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(LogEventAspect.class);
                });
    }

    @Test
    void registersTemplateWhenAppIdPresent() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.application-id=my-app")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogTemplate.class);
                });
    }

    @Test
    void registersTemplateWhenSpringAppNamePresent() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "spring.application.name=my-spring-app")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogTemplate.class);
                });
    }

    @Test
    void doesNotRegisterTemplateWithoutIdentity() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(EventLogTemplate.class);
                });
    }

    // --- Async configuration ---

    @Test
    void asyncDisabledSkipsAsyncLogger() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(AsyncEventLogger.class);
                });
    }

    @Test
    void asyncEnabledByDefault() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void spilloverPathConfigured() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.spillover-path=/tmp/spill")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void invalidReplayAndSpilloverLimitsFailFast() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.spillover-path=/tmp/spill",
                        "eventlog.async.replay-interval-ms=999",
                        "eventlog.async.max-spillover-events=0",
                        "eventlog.async.max-spillover-size-mb=0")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(IllegalArgumentException.class);
                    assertThat(context.getStartupFailure()).hasMessageContaining("replayIntervalMs");
                });
    }

    // --- Dev profile defaults ---

    @Test
    void devProfileUsesDevDefaults() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "spring.profiles.active=dev")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogClient.class);
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void localProfileUsesDevDefaults() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "spring.profiles.active=local")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogClient.class);
                });
    }

    @Test
    void prodProfileUsesStandardDefaults() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "spring.profiles.active=prod")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogClient.class);
                });
    }

    @Test
    void explicitPropertyOverridesDevDefault() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.connect-timeout=15s",
                        "spring.profiles.active=dev")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogClient.class);
                });
    }

    // --- Executor resolution ---

    @Test
    void virtualThreadsExecutorConfig() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.executor=virtual")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void springExecutorConfig() {
        contextRunner
                .withUserConfiguration(TaskExecutorConfig.class)
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.executor=spring")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void springExecutorConfigNoBean() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.executor=spring")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void namedBeanExecutorConfig() {
        contextRunner
                .withUserConfiguration(NamedExecutorConfig.class)
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.executor=myExec")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void namedBeanScheduledExecutorService() {
        contextRunner
                .withUserConfiguration(ScheduledExecutorConfig.class)
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.executor=myScheduled")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void namedBeanThreadPoolTaskSchedulerThrowsAsPlainExecutor() {
        // ThreadPoolTaskScheduler implements Executor but not ExecutorService,
        // so it hits the "must be ExecutorService or ThreadPoolTaskExecutor" guard
        contextRunner
                .withUserConfiguration(TaskSchedulerConfig.class)
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.executor=myTaskScheduler")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure()).rootCause()
                            .isInstanceOf(IllegalStateException.class)
                            .hasMessageContaining("must be ExecutorService or ThreadPoolTaskExecutor");
                });
    }

    @Test
    void namedBeanThrowsWhenMissing() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.executor=missingBean")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure()).rootCause()
                            .isInstanceOf(IllegalStateException.class)
                            .hasMessageContaining("No bean named 'missingBean'");
                });
    }

    @Test
    void namedBeanThrowsWhenNotExecutor() {
        contextRunner
                .withUserConfiguration(StringBeanConfig.class)
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.executor=notAnExecutor")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure()).rootCause()
                            .isInstanceOf(IllegalStateException.class)
                            .hasMessageContaining("is not an Executor");
                });
    }

    @Test
    void fallbackToTaskExecutorBeanWhenNoConfig() {
        contextRunner
                .withUserConfiguration(TaskExecutorConfig.class)
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void fallbackToTaskSchedulerForRetryExecutor() {
        contextRunner
                .withUserConfiguration(FallbackSchedulerConfig.class)
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    // --- OAuth ---

    @Test
    void registersOAuthTokenProvider() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.oauth.token-url=https://auth.test/token",
                        "eventlog.oauth.client-id=my-client",
                        "eventlog.oauth.client-secret=my-secret")
                .run(context -> {
                    assertThat(context).hasSingleBean(OAuthTokenProvider.class);
                    assertThat(context).hasSingleBean(TokenProvider.class);
                });
    }

    @Test
    void oauthTokenProviderWithScope() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.oauth.token-url=https://auth.test/token",
                        "eventlog.oauth.client-id=my-client",
                        "eventlog.oauth.client-secret=my-secret",
                        "eventlog.oauth.scope=api://eventlog/.default")
                .run(context -> {
                    assertThat(context).hasSingleBean(OAuthTokenProvider.class);
                });
    }

    @Test
    void oauthTokenProviderUsesDevDefaults() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.oauth.token-url=https://auth.test/token",
                        "eventlog.oauth.client-id=my-client",
                        "eventlog.oauth.client-secret=my-secret",
                        "spring.profiles.active=dev")
                .run(context -> {
                    assertThat(context).hasSingleBean(OAuthTokenProvider.class);
                });
    }

    // --- Virtual threads property flag ---

    @Test
    void virtualThreadsPropertyFlag() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.virtual-threads=true")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    // --- Template resolution with target/originating system ---

    @Test
    void registersTemplateWithTargetSystem() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.target-system=MY_TARGET")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogTemplate.class);
                });
    }

    @Test
    void registersTemplateWithOriginatingSystem() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.originating-system=MY_ORIGIN")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogTemplate.class);
                });
    }

    // --- Named bean ThreadPoolTaskExecutor ---

    @Test
    void namedBeanThreadPoolTaskExecutorConfig() {
        contextRunner
                .withUserConfiguration(NamedTaskExecutorConfig.class)
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.async.executor=myTaskExec")
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    // --- Helper/utility methods ---

    @Test
    void resolveDefaultsUsesApplicationId() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "eventlog.application-id=explicit-app",
                        "spring.application.name=spring-app")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogTemplate.class);
                });
    }

    @Test
    void resolveDefaultsFallsBackToSpringAppName() {
        contextRunner
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk",
                        "spring.application.name=spring-app-name")
                .run(context -> {
                    assertThat(context).hasSingleBean(EventLogTemplate.class);
                });
    }

    // --- Configuration classes ---

    @Configuration
    static class TaskExecutorConfig {
        @Bean
        ThreadPoolTaskExecutor taskExecutor() {
            ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
            executor.setCorePoolSize(2);
            executor.setMaxPoolSize(4);
            executor.initialize();
            return executor;
        }
    }

    @Configuration
    static class NamedExecutorConfig {
        @Bean("myExec")
        ExecutorService myExec() {
            return Executors.newFixedThreadPool(2);
        }
    }

    @Configuration
    static class ScheduledExecutorConfig {
        @Bean("myScheduled")
        ScheduledExecutorService myScheduled() {
            return Executors.newScheduledThreadPool(2);
        }
    }

    @Configuration
    static class TaskSchedulerConfig {
        @Bean("myTaskScheduler")
        ThreadPoolTaskScheduler myTaskScheduler() {
            ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
            scheduler.setPoolSize(2);
            scheduler.initialize();
            return scheduler;
        }
    }

    @Configuration
    static class StringBeanConfig {
        @Bean("notAnExecutor")
        String notAnExecutor() {
            return "I am not an executor";
        }
    }

    @Configuration
    static class FallbackSchedulerConfig {
        @Bean
        ThreadPoolTaskScheduler taskScheduler() {
            ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
            scheduler.setPoolSize(2);
            scheduler.initialize();
            return scheduler;
        }
    }

    @Configuration
    static class NamedTaskExecutorConfig {
        @Bean("myTaskExec")
        ThreadPoolTaskExecutor myTaskExec() {
            ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
            executor.setCorePoolSize(2);
            executor.setMaxPoolSize(4);
            executor.initialize();
            return executor;
        }
    }
}
