package com.eventlog.sdk.client;

import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MockAsyncEventLoggerTest {

    private MockAsyncEventLogger logger;

    @BeforeEach
    void setUp() {
        logger = new MockAsyncEventLogger();
    }

    // --- Constructor & initialization ---

    @Test
    void defaultConstructorCreatesInstance() {
        MockAsyncEventLogger mock = new MockAsyncEventLogger();
        assertThat(mock).isNotNull();
        assertThat(mock.getCapturedEvents()).isEmpty();
    }

    @Test
    void constructorWithClientCreatesInstance() {
        EventLogClient client = EventLogClient.builder().baseUrl("http://test-server").build();
        MockAsyncEventLogger mock = new MockAsyncEventLogger(client);
        assertThat(mock).isNotNull();
        assertThat(mock.getCapturedEvents()).isEmpty();
    }

    // --- Single event logging ---

    @Test
    void logCapturesSingleEvent() {
        EventLogEntry event = createTestEvent("PROCESS_A", EventType.STEP);
        logger.log(event);
        assertThat(logger.getCapturedEvents()).hasSize(1);
        assertThat(logger.getCapturedEvents().get(0)).isSameAs(event);
    }

    @Test
    void logAlwaysReturnsTrue() {
        EventLogEntry event = createTestEvent("PROCESS_A", EventType.STEP);
        assertThat(logger.log(event)).isTrue();
    }

    @Test
    void logMultipleEventsInSequence() {
        EventLogEntry e1 = createTestEvent("P1", EventType.PROCESS_START);
        EventLogEntry e2 = createTestEvent("P1", EventType.STEP);
        EventLogEntry e3 = createTestEvent("P1", EventType.PROCESS_END);

        logger.log(e1);
        logger.log(e2);
        logger.log(e3);

        assertThat(logger.getCapturedEvents()).containsExactly(e1, e2, e3);
    }

    // --- Batch event logging ---

    @Test
    void logBatchCapturesAllEvents() {
        EventLogEntry e1 = createTestEvent("P1", EventType.STEP);
        EventLogEntry e2 = createTestEvent("P2", EventType.STEP);
        List<EventLogEntry> batch = Arrays.asList(e1, e2);

        int count = logger.log(batch);

        assertThat(count).isEqualTo(2);
        assertThat(logger.getCapturedEvents()).containsExactly(e1, e2);
    }

    @Test
    void logBatchNullReturnsZero() {
        int count = logger.log((List<EventLogEntry>) null);
        assertThat(count).isZero();
        assertThat(logger.getCapturedEvents()).isEmpty();
    }

    @Test
    void logBatchEmptyListReturnsZero() {
        int count = logger.log(Collections.emptyList());
        assertThat(count).isZero();
        assertThat(logger.getCapturedEvents()).isEmpty();
    }

    @Test
    void logBatchReturnsSizeOfList() {
        List<EventLogEntry> batch = Arrays.asList(
                createTestEvent("P1", EventType.STEP),
                createTestEvent("P2", EventType.STEP),
                createTestEvent("P3", EventType.STEP));
        assertThat(logger.log(batch)).isEqualTo(3);
    }

    // --- Query & filter API ---

    @Test
    void getCapturedEventsReturnsUnmodifiableList() {
        logger.log(createTestEvent("P1", EventType.STEP));
        List<EventLogEntry> events = logger.getCapturedEvents();
        assertThatThrownBy(() -> events.add(createTestEvent("P2", EventType.STEP)))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void getCapturedEventsReturnsAllInOrder() {
        EventLogEntry e1 = createTestEvent("P1", EventType.PROCESS_START);
        EventLogEntry e2 = createTestEvent("P2", EventType.STEP);
        EventLogEntry e3 = createTestEvent("P3", EventType.PROCESS_END);

        logger.log(e1);
        logger.log(e2);
        logger.log(e3);

        assertThat(logger.getCapturedEvents()).containsExactly(e1, e2, e3);
    }

    @Test
    void getEventsForProcessFiltersCorrectly() {
        logger.log(createTestEvent("ORDER", EventType.STEP));
        logger.log(createTestEvent("PAYMENT", EventType.STEP));
        logger.log(createTestEvent("ORDER", EventType.PROCESS_END));

        List<EventLogEntry> orderEvents = logger.getEventsForProcess("ORDER");
        assertThat(orderEvents).hasSize(2);
        assertThat(orderEvents).allMatch(e -> "ORDER".equals(e.getProcessName()));
    }

    @Test
    void getEventsForProcessReturnsEmptyForNoMatch() {
        logger.log(createTestEvent("ORDER", EventType.STEP));
        assertThat(logger.getEventsForProcess("UNKNOWN")).isEmpty();
    }

    // --- State management ---

    @Test
    void resetClearsAllEvents() {
        logger.log(createTestEvent("P1", EventType.STEP));
        logger.log(createTestEvent("P2", EventType.STEP));
        assertThat(logger.getCapturedEvents()).hasSize(2);

        logger.reset();
        assertThat(logger.getCapturedEvents()).isEmpty();
    }

    @Test
    void logWorksAfterReset() {
        logger.log(createTestEvent("P1", EventType.STEP));
        logger.reset();

        EventLogEntry newEvent = createTestEvent("P2", EventType.STEP);
        logger.log(newEvent);
        assertThat(logger.getCapturedEvents()).containsExactly(newEvent);
    }

    // --- Assertions ---

    @Test
    void assertEventCountPassesOnMatch() {
        logger.log(createTestEvent("P1", EventType.STEP));
        logger.log(createTestEvent("P2", EventType.STEP));
        logger.assertEventCount(2); // should not throw
    }

    @Test
    void assertEventCountThrowsOnMismatch() {
        logger.log(createTestEvent("P1", EventType.STEP));
        assertThatThrownBy(() -> logger.assertEventCount(5))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("Expected 5 events but found 1");
    }

    @Test
    void assertEventCountZeroOnEmpty() {
        logger.assertEventCount(0); // should not throw
    }

    @Test
    void assertEventLoggedPassesOnMatch() {
        logger.log(createTestEvent("ORDER", EventType.STEP));
        logger.assertEventLogged("ORDER", EventType.STEP); // should not throw
    }

    @Test
    void assertEventLoggedThrowsOnNoMatch() {
        assertThatThrownBy(() -> logger.assertEventLogged("ORDER", EventType.STEP))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("Expected event for process 'ORDER' with type 'STEP'");
    }

    @Test
    void assertEventLoggedMatchesProcessButNotType() {
        logger.log(createTestEvent("ORDER", EventType.PROCESS_START));
        assertThatThrownBy(() -> logger.assertEventLogged("ORDER", EventType.ERROR))
                .isInstanceOf(AssertionError.class);
    }

    // --- Helper ---

    private static EventLogEntry createTestEvent(String processName, EventType eventType) {
        return EventLogEntry.builder()
                .correlationId("corr-test")
                .traceId("trace-test")
                .applicationId("test-app")
                .targetSystem("TEST")
                .originatingSystem("TEST")
                .processName(processName)
                .eventType(eventType)
                .eventStatus(EventStatus.SUCCESS)
                .summary("Test event")
                .result("OK")
                .build();
    }
}
