package com.example.petresort.exception;

import com.eventlog.sdk.template.EventLogTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final EventLogTemplate eventLogTemplate;

    public GlobalExceptionHandler(EventLogTemplate eventLogTemplate) {
        this.eventLogTemplate = eventLogTemplate;
    }

    @ExceptionHandler(PetNotFoundException.class)
    public ProblemDetail handlePetNotFound(PetNotFoundException ex) {
        logError("PET_NOT_FOUND", ex.getMessage(), "Pet lookup");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Pet Not Found");
        return problem;
    }

    @ExceptionHandler(OwnerNotFoundException.class)
    public ProblemDetail handleOwnerNotFound(OwnerNotFoundException ex) {
        logError("OWNER_NOT_FOUND", ex.getMessage(), "Owner lookup");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Owner Not Found");
        return problem;
    }

    @ExceptionHandler(BookingNotFoundException.class)
    public ProblemDetail handleBookingNotFound(BookingNotFoundException ex) {
        logError("BOOKING_NOT_FOUND", ex.getMessage(), "Booking operation");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Booking Not Found");
        return problem;
    }

    @ExceptionHandler(BookingConflictException.class)
    public ProblemDetail handleBookingConflict(BookingConflictException ex) {
        logError(ex.getErrorCode(), ex.getMessage(), "Booking state transition");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setTitle("Booking Conflict");
        return problem;
    }

    @ExceptionHandler(KennelVendorTimeoutException.class)
    public ProblemDetail handleKennelVendorTimeout(KennelVendorTimeoutException ex) {
        logError("KENNEL_VENDOR_TIMEOUT", ex.getMessage(), "Kennel vendor communication");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.GATEWAY_TIMEOUT, ex.getMessage());
        problem.setTitle("Kennel Vendor Timeout");
        return problem;
    }

    @ExceptionHandler(PaymentFailedException.class)
    public ProblemDetail handlePaymentFailed(PaymentFailedException ex) {
        logError("PAYMENT_FAILED", ex.getMessage(), "Payment processing");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
        problem.setTitle("Payment Failed");
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("Validation failed");

        logError("VALIDATION_ERROR", message, "Request validation");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, message);
        problem.setTitle("Validation Error");
        return problem;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        logError("INTERNAL_ERROR", ex.getMessage(), "Unhandled exception");
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred");
        problem.setTitle("Internal Server Error");
        return problem;
    }

    private void logError(String errorCode, String errorMessage, String context) {
        String correlationId = MDC.get("correlationId");
        String traceId = MDC.get("traceId");

        if (correlationId != null && traceId != null) {
            eventLogTemplate.logError(
                    correlationId, traceId, "ERROR_HANDLER",
                    errorCode, errorMessage,
                    "Handle " + context + " — error (" + errorCode + ")");
        }
    }
}
