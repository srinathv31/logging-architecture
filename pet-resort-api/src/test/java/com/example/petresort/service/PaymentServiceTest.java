package com.example.petresort.service;

import com.eventlog.sdk.client.MockAsyncEventLogger;
import com.eventlog.sdk.model.EventLogEntry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PaymentServiceTest {

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    @Test
    void processPayment_checksLogReturnValue() {
        // Given: a MockAsyncEventLogger subclass that returns false from log()
        MockAsyncEventLogger falseLogger = new MockAsyncEventLogger() {
            @Override
            public boolean log(EventLogEntry event) {
                super.log(event); // still capture for inspection
                return false;     // simulate queue-full / event loss
            }
        };

        PaymentService paymentService = new PaymentService(
                falseLogger, "pet-resort-api-test", "PET_RESORT", "PET_RESORT", new SimpleMeterRegistry());

        MDC.put("correlationId", "corr-pay-test");
        MDC.put("traceId", "trace-pay-test");

        // When: processPayment completes (non-blocking despite log returning false)
        boolean result = paymentService.processPayment("BKG-001", new BigDecimal("150.00"), "1234", null);

        // Then: method still completes successfully
        assertTrue(result, "processPayment should still return true");

        // Verify events were still captured (log was called)
        List<EventLogEntry> events = falseLogger.getCapturedEvents();
        assertEquals(2, events.size(), "Expected payment + audit events even though log returned false");
    }

    @Test
    void processPayment_success_logsEvents() {
        // Given
        MockAsyncEventLogger mockEventLogger = new MockAsyncEventLogger();
        PaymentService paymentService = new PaymentService(
                mockEventLogger, "pet-resort-api-test", "PET_RESORT", "PET_RESORT", new SimpleMeterRegistry());

        MDC.put("correlationId", "corr-pay-success");
        MDC.put("traceId", "trace-pay-success");

        // When
        boolean result = paymentService.processPayment("BKG-002", new BigDecimal("200.00"), "5678", "parent-span-123");

        // Then
        assertTrue(result);

        List<EventLogEntry> events = mockEventLogger.getCapturedEvents();
        assertEquals(2, events.size(), "Expected payment + audit events");

        // Payment event
        EventLogEntry paymentEvent = events.get(0);
        assertEquals("PROCESS_PAYMENT", paymentEvent.getProcessName());
        assertEquals("PAYMENT_PROCESSED", paymentEvent.getResult());
        assertEquals("corr-pay-success", paymentEvent.getCorrelationId());
        assertEquals("parent-span-123", paymentEvent.getParentSpanId());

        // Audit event
        EventLogEntry auditEvent = events.get(1);
        assertEquals("PAYMENT_AUDIT", auditEvent.getProcessName());
        assertEquals("AUDIT_RECORDED", auditEvent.getResult());
    }
}
