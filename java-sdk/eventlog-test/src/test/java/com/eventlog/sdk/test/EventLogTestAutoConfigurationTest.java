package com.eventlog.sdk.test;

import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.MockAsyncEventLogger;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class EventLogTestAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventLogTestAutoConfiguration.class));

    @Test
    void registersMockBeanWithTestProfile() {
        contextRunner
                .withPropertyValues("spring.profiles.active=test")
                .run(context -> {
                    assertThat(context).hasSingleBean(MockAsyncEventLogger.class);
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                });
    }

    @Test
    void doesNotRegisterBeanWithoutTestProfile() {
        contextRunner
                .withPropertyValues("spring.profiles.active=prod")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(MockAsyncEventLogger.class);
                });
    }

    @Test
    void doesNotRegisterBeanWhenAsyncEventLoggerAlreadyExists() {
        contextRunner
                .withPropertyValues("spring.profiles.active=test")
                .withUserConfiguration(ExistingLoggerConfig.class)
                .run(context -> {
                    assertThat(context).hasSingleBean(AsyncEventLogger.class);
                    assertThat(context).doesNotHaveBean(MockAsyncEventLogger.class);
                });
    }

    @Configuration
    static class ExistingLoggerConfig {
        @Bean
        AsyncEventLogger asyncEventLogger() {
            return mock(AsyncEventLogger.class);
        }
    }
}
