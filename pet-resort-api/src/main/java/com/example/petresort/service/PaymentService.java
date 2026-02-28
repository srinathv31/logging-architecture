package com.example.petresort.service;

import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.util.EventLogUtils;
import com.example.petresort.exception.PaymentFailedException;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final Counter paymentsTotal;
    private final Counter paymentsFailed;

    public PaymentService(MeterRegistry registry) {
        this.paymentsTotal = Counter.builder("petresort.payments.total")
                .description("Total payment attempts")
                .register(registry);
        this.paymentsFailed = Counter.builder("petresort.payments.failed")
                .description("Total failed payments")
                .register(registry);
    }

    @LogEvent(process = "PROCESS_PAYMENT", step = 1, name = "Charge Card",
              summary = "Payment processed via payment gateway",
              result = "PAYMENT_PROCESSED",
              failureSummary = "Payment processing failed",
              failureResult = "PAYMENT_DECLINED",
              errorCode = "PAYMENT_DECLINED")
    public boolean processPayment(String bookingId, BigDecimal amount, String cardLast4) {
        paymentsTotal.increment();

        // Check for payment-failure simulation
        String simulate = MDC.get("simulate");
        if ("payment-failure".equals(simulate)) {
            try { Thread.sleep(800); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            paymentsFailed.increment();
            throw new PaymentFailedException(bookingId,
                    "Card declined: ***" + EventLogUtils.maskLast4(cardLast4));
        }

        // Simulate: negative amounts fail
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            paymentsFailed.increment();
            throw new PaymentFailedException(bookingId, "Invalid payment amount: " + amount);
        }

        // Simulate Stripe API call latency
        try { Thread.sleep(100); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        log.debug("Payment processed for booking {} — amount: {}, card: {}",
                bookingId, amount, EventLogUtils.maskLast4(cardLast4));

        return true;
    }
}
