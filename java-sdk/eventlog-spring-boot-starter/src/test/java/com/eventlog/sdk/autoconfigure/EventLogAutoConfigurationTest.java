package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.transport.EventLogTransport;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class EventLogAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventLogAutoConfiguration.class));

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
}
