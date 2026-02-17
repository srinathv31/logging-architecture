package com.example.petresort.service;

import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import com.eventlog.sdk.util.EventLogUtils;
import com.example.petresort.exception.PaymentFailedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final AsyncEventLogger asyncEventLogger;
    private final String applicationId;
    private final String targetSystem;
    private final String originatingSystem;

    public PaymentService(AsyncEventLogger asyncEventLogger,
                          @Value("${eventlog.application-id}") String applicationId,
                          @Value("${eventlog.target-system}") String targetSystem,
                          @Value("${eventlog.originating-system}") String originatingSystem) {
        this.asyncEventLogger = asyncEventLogger;
        this.applicationId = applicationId;
        this.targetSystem = targetSystem;
        this.originatingSystem = originatingSystem;
    }

    /**
     * Demonstrates raw EventLogEntry.builder() usage — the most manual approach.
     * Useful when you need full control over every field.
     */
    public boolean processPayment(String bookingId, BigDecimal amount, String cardLast4, String parentSpanId) {
        String correlationId = MDC.get("correlationId");
        String traceId = MDC.get("traceId");
        long start = System.currentTimeMillis();

        // Build the event entry using the raw builder
        EventLogEntry.Builder paymentBuilder = EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .spanId(EventLogUtils.createSpanId())
                .applicationId(applicationId)
                .targetSystem(targetSystem)
                .originatingSystem(originatingSystem)
                .processName("PROCESS_PAYMENT")
                .stepSequence(1)
                .stepName("Charge Card")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary(EventLogUtils.generateSummary("Process", "payment",
                        "charged", amount + " to card"))
                .result("PAYMENT_PROCESSED")
                .metadata(Map.of(
                        "booking_id", bookingId,
                        "amount", amount.toString(),
                        "card_last4", EventLogUtils.maskLast4(cardLast4),
                        "currency", "USD"))
                .executionTimeMs((int) (System.currentTimeMillis() - start));

        if (parentSpanId != null && !parentSpanId.isBlank()) {
            paymentBuilder.parentSpanId(parentSpanId);
        }

        EventLogEntry paymentEvent = paymentBuilder.build();

        // Fire-and-forget via AsyncEventLogger
        asyncEventLogger.log(paymentEvent);

        // Demonstrate toBuilder() — copy and modify pattern (fresh spanId for audit)
        EventLogEntry.Builder auditBuilder = paymentEvent.toBuilder()
                .spanId(EventLogUtils.createSpanId())
                .processName("PAYMENT_AUDIT")
                .stepName("Audit Trail")
                .summary("Payment audit record created")
                .result("AUDIT_RECORDED");
        asyncEventLogger.log(auditBuilder.build());

        log.debug("Payment processed for booking {} — amount: {}, card: {}",
                bookingId, amount, EventLogUtils.maskLast4(cardLast4));

        // Simulate: negative amounts fail
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new PaymentFailedException(bookingId, "Invalid payment amount: " + amount);
        }

        return true;
    }

    @Deprecated
    public boolean processPayment(String bookingId, BigDecimal amount, String cardLast4) {
        return processPayment(bookingId, amount, cardLast4, null);
    }
}
