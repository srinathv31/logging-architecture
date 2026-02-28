package com.example.petresort.service;

import com.example.petresort.exception.PaymentFailedException;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class PaymentServiceTest {

    private final PaymentService paymentService = new PaymentService(new SimpleMeterRegistry());

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    @Test
    void processPayment_success() {
        MDC.put("correlationId", "corr-pay-success");
        MDC.put("traceId", "trace-pay-success");

        boolean result = paymentService.processPayment("BKG-001", new BigDecimal("150.00"), "1234");

        assertTrue(result, "processPayment should return true on success");
    }

    @Test
    void processPayment_simulatedFailure_throwsPaymentFailed() {
        MDC.put("correlationId", "corr-pay-fail");
        MDC.put("traceId", "trace-pay-fail");
        MDC.put("simulate", "payment-failure");

        assertThrows(PaymentFailedException.class,
                () -> paymentService.processPayment("BKG-002", new BigDecimal("200.00"), "5678"));
    }

    @Test
    void processPayment_invalidAmount_throwsPaymentFailed() {
        MDC.put("correlationId", "corr-pay-invalid");
        MDC.put("traceId", "trace-pay-invalid");

        assertThrows(PaymentFailedException.class,
                () -> paymentService.processPayment("BKG-003", new BigDecimal("-50.00"), "9999"));
    }
}
