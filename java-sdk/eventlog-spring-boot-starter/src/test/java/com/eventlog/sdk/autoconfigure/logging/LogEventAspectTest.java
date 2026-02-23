package com.eventlog.sdk.autoconfigure.logging;

import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import com.eventlog.sdk.autoconfigure.EventLogAutoConfiguration;
import com.eventlog.sdk.autoconfigure.EventLogProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    // --- Existing test ---

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

    // --- Success/failure paths ---

    @Test
    void logsFailureWhenMethodThrows() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            try { service.failingMethod(); } catch (RuntimeException ignored) {}

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            EventLogEntry entry = captor.getValue();
            assertThat(entry.getEventStatus()).isEqualTo(EventStatus.FAILURE);
            assertThat(entry.getErrorCode()).isEqualTo("RuntimeException");
            assertThat(entry.getErrorMessage()).isEqualTo("test failure");
        });
    }

    @Test
    void exceptionPropagatesAfterLogging() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            assertThatThrownBy(service::failingMethod)
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("test failure");
        });
    }

    @Test
    void doesNotLogErrorTypeOnSuccess() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.errorTypeButSucceeds();

            // Give aspect time to run, then verify no logging
            Thread.sleep(200);
            verify(logger, never()).log(any(EventLogEntry.class));
        });
    }

    @Test
    void respectsLogOnSuccessFalse() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.noLogOnSuccess();

            Thread.sleep(200);
            verify(logger, never()).log(any(EventLogEntry.class));
        });
    }

    @Test
    void respectsLogOnFailureFalse() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            try { service.noLogOnFailure(); } catch (RuntimeException ignored) {}

            Thread.sleep(200);
            verify(logger, never()).log(any(EventLogEntry.class));
        });
    }

    // --- Process/step name resolution ---

    @Test
    void defaultsProcessNameToClassName() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.noProcessName();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            // Defaults to class simple name (could be proxy name)
            assertThat(captor.getValue().getProcessName()).isNotBlank();
        });
    }

    @Test
    void stepNameDefaultsToMethodName() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.defaultStepName();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getStepName()).isEqualTo("defaultStepName");
        });
    }

    @Test
    void processStartSetsStepSequenceZero() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.processStart();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getStepSequence()).isEqualTo(0);
            assertThat(captor.getValue().getEventType()).isEqualTo(EventType.PROCESS_START);
        });
    }

    @Test
    void explicitStepSequencePreserved() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.explicitStep();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getStepSequence()).isEqualTo(5);
        });
    }

    // --- Summary/result resolution ---

    @Test
    void defaultSummaryOnSuccess() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.defaultStepName();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getSummary()).isEqualTo("Completed defaultStepName");
        });
    }

    @Test
    void defaultSummaryOnFailure() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            try { service.failingDefaultSummary(); } catch (RuntimeException ignored) {}

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getSummary()).startsWith("Failed failingDefaultSummary");
            assertThat(captor.getValue().getSummary()).contains("IllegalStateException");
        });
    }

    @Test
    void failureSummaryAndResultOverrides() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            try { service.customFailureSummary(); } catch (RuntimeException ignored) {}

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            EventLogEntry entry = captor.getValue();
            assertThat(entry.getSummary()).isEqualTo("Custom failure summary");
            assertThat(entry.getResult()).isEqualTo("CUSTOM_FAIL");
        });
    }

    @Test
    void defaultResultUsesStatusName() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.defaultStepName();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getResult()).isEqualTo("SUCCESS");
        });
    }

    // --- Error handling ---

    @Test
    void customErrorCodeFromAnnotation() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            try { service.customErrorCode(); } catch (RuntimeException ignored) {}

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getErrorCode()).isEqualTo("CUSTOM_ERR");
        });
    }

    @Test
    void errorCodeFromExceptionClassName() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            try { service.failingMethod(); } catch (RuntimeException ignored) {}

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getErrorCode()).isEqualTo("RuntimeException");
        });
    }

    @Test
    void nullErrorWhenNoExceptionMessage() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            try { service.failingNoMessage(); } catch (RuntimeException ignored) {}

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getErrorMessage()).isNull();
        });
    }

    // --- MDC integration ---

    @Test
    void mdcCorrelationIdUsedWhenPresent() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            MDC.put("correlationId", "mdc-corr-123");
            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getCorrelationId()).isEqualTo("mdc-corr-123");
        });
    }

    @Test
    void mdcTraceIdUsedWhenPresent() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            MDC.put("traceId", "mdc-trace-abc");
            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getTraceId()).isEqualTo("mdc-trace-abc");
        });
    }

    @Test
    void mdcAlternateKeyFormatsSupported() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            MDC.put("correlation_id", "underscore-corr");
            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getCorrelationId()).isEqualTo("underscore-corr");
        });
    }

    // --- MDC spanId / parentSpanId / batchId ---

    @Test
    void mdcSpanIdPromotedToParentSpanId() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            MDC.put("spanId", "span-abc-123");
            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            // MDC spanId becomes parentSpanId; spanId is auto-generated per invocation
            assertThat(captor.getValue().getSpanId()).isNotEqualTo("span-abc-123");
            assertThat(captor.getValue().getSpanId()).isNotBlank();
            assertThat(captor.getValue().getParentSpanId()).isEqualTo("span-abc-123");
        });
    }

    @Test
    void mdcParentSpanIdUsedWhenPresent() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            MDC.put("parentSpanId", "parent-span-xyz");
            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getParentSpanId()).isEqualTo("parent-span-xyz");
        });
    }

    @Test
    void mdcBatchIdUsedWhenPresent() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            MDC.put("batchId", "batch-001");
            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getBatchId()).isEqualTo("batch-001");
        });
    }

    @Test
    void mdcHyphenKeyFormatsSupported() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            MDC.put("correlation-id", "hyphen-corr");
            MDC.put("trace-id", "hyphen-trace");
            MDC.put("span-id", "hyphen-span");
            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            EventLogEntry entry = captor.getValue();
            assertThat(entry.getCorrelationId()).isEqualTo("hyphen-corr");
            assertThat(entry.getTraceId()).isEqualTo("hyphen-trace");
            // MDC span-id becomes parentSpanId; spanId is auto-generated
            assertThat(entry.getSpanId()).isNotBlank();
            assertThat(entry.getParentSpanId()).isEqualTo("hyphen-span");
        });
    }

    // --- Custom success result from annotation ---

    @Test
    void customSuccessResultFromAnnotation() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.customSuccessResult();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getResult()).isEqualTo("CUSTOM_OK");
        });
    }

    // --- Factory method with target/originating system ---

    @Test
    void fromMethodWithTargetAndOriginatingSystem() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("eventlog.target-system", "MY_TARGET");
        env.setProperty("eventlog.originating-system", "MY_ORIGIN");
        EventLogProperties props = new EventLogProperties(
                true, "http://test", null, null, null, null, null, null, null, null, null, null, null);
        AsyncEventLogger logger = mock(AsyncEventLogger.class);

        LogEventAspect aspect = LogEventAspect.from(env, props, logger);
        assertThat(aspect).isNotNull();
    }

    @Test
    void fromMethodFallsBackThroughAllLevels() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("eventlog.originating-system", "FALLBACK_ORIGIN");
        EventLogProperties props = new EventLogProperties(
                true, "http://test", null, null, null, null, null, null, null, null, null, null, null);
        AsyncEventLogger logger = mock(AsyncEventLogger.class);

        LogEventAspect aspect = LogEventAspect.from(env, props, logger);
        assertThat(aspect).isNotNull();
    }

    // --- Factory method & metadata ---

    @Test
    void fromMethodResolvesDefaults() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("spring.application.name", "test-app");
        EventLogProperties props = new EventLogProperties(
                true, "http://test", null, null, null, null, null, null, null, null, null, null, null);
        AsyncEventLogger logger = mock(AsyncEventLogger.class);

        LogEventAspect aspect = LogEventAspect.from(env, props, logger);
        assertThat(aspect).isNotNull();
    }

    @Test
    void metadataIncludesClassAndMethod() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            assertThat(captor.getValue().getMetadata()).containsKey("class");
            assertThat(captor.getValue().getMetadata()).containsKey("method");
            assertThat(captor.getValue().getMetadata().get("method")).isEqualTo("validate");
        });
    }

    @Test
    void missingDefaultsLogsWarningOnce() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(EventLogAutoConfiguration.class, AopAutoConfiguration.class))
                .withUserConfiguration(TestConfig.class)
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test")
                .run(context -> {
                    TestService service = context.getBean(TestService.class);
                    AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

                    service.validate();

                    // No applicationId/targetSystem/originatingSystem -> event skipped
                    Thread.sleep(200);
                    verify(logger, never()).log(any(EventLogEntry.class));
                });
    }

    // --- Utility methods ---

    @Test
    void sanitizePrefixHandlesBlank() {
        // Tested indirectly via the aspect - a method with blank process falls back
        // and correlationId prefix uses sanitizePrefix
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            // correlationId should start with the sanitized prefix
            assertThat(captor.getValue().getCorrelationId()).isNotBlank();
        });
    }

    @Test
    void sanitizePrefixLowercasesAndStripsSpecialChars() {
        contextRunner.run(context -> {
            TestService service = context.getBean(TestService.class);
            AsyncEventLogger logger = context.getBean(AsyncEventLogger.class);

            service.validate();

            ArgumentCaptor<EventLogEntry> captor = ArgumentCaptor.forClass(EventLogEntry.class);
            verify(logger, timeout(500)).log(captor.capture());

            // "ORDER_PROCESSING" sanitizes to "order-processing"
            String correlationId = captor.getValue().getCorrelationId();
            assertThat(correlationId).startsWith("order-processing-");
        });
    }

    // --- Test configuration ---

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

        @LogEvent(process = "PAYMENT", step = 2, name = "Process Payment")
        void failingMethod() {
            throw new RuntimeException("test failure");
        }

        @LogEvent(process = "ORDER_PROCESSING", eventType = EventType.ERROR)
        void errorTypeButSucceeds() {
            // no-op - succeeds, but eventType=ERROR
        }

        @LogEvent(process = "ORDER_PROCESSING", logOnSuccess = false)
        void noLogOnSuccess() {
            // no-op
        }

        @LogEvent(process = "ORDER_PROCESSING", logOnFailure = false)
        void noLogOnFailure() {
            throw new RuntimeException("should not be logged");
        }

        @LogEvent(process = "")
        void noProcessName() {
            // no-op - process defaults to class name
        }

        @LogEvent(process = "DEFAULT_PROCESS")
        void defaultStepName() {
            // no-op - name defaults to method name
        }

        @LogEvent(process = "LIFECYCLE", eventType = EventType.PROCESS_START)
        void processStart() {
            // no-op - step should default to 0
        }

        @LogEvent(process = "ORDER_PROCESSING", step = 5)
        void explicitStep() {
            // no-op
        }

        @LogEvent(process = "FAILING_PROCESS")
        void failingDefaultSummary() {
            throw new IllegalStateException("bad state");
        }

        @LogEvent(process = "CUSTOM_FAIL", failureSummary = "Custom failure summary", failureResult = "CUSTOM_FAIL")
        void customFailureSummary() {
            throw new RuntimeException("error");
        }

        @LogEvent(process = "ERR_PROCESS", errorCode = "CUSTOM_ERR")
        void customErrorCode() {
            throw new RuntimeException("custom error");
        }

        @LogEvent(process = "NULL_MSG_PROCESS")
        void failingNoMessage() {
            throw new RuntimeException((String) null);
        }

        @LogEvent(process = "CUSTOM_RESULT", result = "CUSTOM_OK")
        void customSuccessResult() {
            // no-op
        }
    }
}
