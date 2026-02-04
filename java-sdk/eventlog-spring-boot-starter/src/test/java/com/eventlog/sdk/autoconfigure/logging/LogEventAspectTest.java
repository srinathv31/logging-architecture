package com.eventlog.sdk.autoconfigure.logging;

import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import com.eventlog.sdk.autoconfigure.EventLogAutoConfiguration;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class LogEventAspectTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(EventLogAutoConfiguration.class, AopAutoConfiguration.class))
            .withUserConfiguration(TestConfig.class)
            .withPropertyValues(
                    "eventlog.enabled=true",
                    "eventlog.base-url=https://eventlog-api.test",
                    "eventlog.application-id=order-service",
                    "eventlog.target-system=ORDER_SERVICE",
                    "eventlog.originating-system=ORDER_SERVICE");

    @Test
    void logsAnnotatedMethodExecution() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            EventLogEntry entry = captor.getValue();
            assertThat(entry.getProcessName()).isEqualTo("ORDER_PROCESSING");
            assertThat(entry.getStepSequence()).isEqualTo(1);
            assertThat(entry.getStepName()).isEqualTo("Validate Order");
            assertThat(entry.getEventType()).isEqualTo(EventType.STEP);
            assertThat(entry.getEventStatus()).isEqualTo(EventStatus.SUCCESS);
            assertThat(entry.getSummary()).isEqualTo("Order validated");
            assertThat(entry.getResult()).isEqualTo("OK");
            assertThat(entry.getExecutionTimeMs()).isNotNull();
        });
    }

    @Configuration
    static class TestConfig {
        @Bean
        AsyncEventLogger asyncEventLogger() {
            AsyncEventLogger logger = mock(AsyncEventLogger.class);
            when(logger.log(any(EventLogEntry.class))).thenReturn(true);
            return logger;
        }

        @Bean
        TestService testService() {
            return new TestService();
        }
    }

    static class TestService {
        @LogEvent(process = "ORDER_PROCESSING", step = 1, name = "Validate Order", summary = "Order validated", result = "OK")
        void validate() {
            // no-op
        }
    }
}
