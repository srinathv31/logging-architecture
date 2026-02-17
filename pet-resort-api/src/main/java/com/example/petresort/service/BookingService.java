package com.example.petresort.service;

import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import com.eventlog.sdk.model.HttpMethod;
import com.eventlog.sdk.template.EventLogTemplate;
import com.eventlog.sdk.template.EventLogTemplate.ProcessLogger;
import com.eventlog.sdk.util.EventLogUtils;
import com.example.petresort.exception.BookingConflictException;
import com.example.petresort.exception.BookingNotFoundException;
import com.example.petresort.exception.PetNotFoundException;
import com.example.petresort.model.*;
import com.example.petresort.store.InMemoryBookingStore;
import com.example.petresort.store.InMemoryPetStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);

    private final InMemoryBookingStore bookingStore;
    private final InMemoryPetStore petStore;
    private final KennelService kennelService;
    private final PaymentService paymentService;
    private final EventLogTemplate eventLogTemplate;
    private final AsyncEventLogger asyncEventLogger;
    private final EventLogClient eventLogClient;

    public BookingService(InMemoryBookingStore bookingStore,
                          InMemoryPetStore petStore,
                          KennelService kennelService,
                          PaymentService paymentService,
                          EventLogTemplate eventLogTemplate,
                          AsyncEventLogger asyncEventLogger,
                          EventLogClient eventLogClient) {
        this.bookingStore = bookingStore;
        this.petStore = petStore;
        this.kennelService = kennelService;
        this.paymentService = paymentService;
        this.eventLogTemplate = eventLogTemplate;
        this.asyncEventLogger = asyncEventLogger;
        this.eventLogClient = eventLogClient;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Approach 1: ProcessLogger — fluent multi-step process logging
    // ──────────────────────────────────────────────────────────────────────

    public Booking createBooking(CreateBookingRequest request) {
        long start = System.currentTimeMillis();
        String correlationId = EventLogUtils.createCorrelationId("booking");
        String traceId = EventLogUtils.createTraceId();
        String spanId = EventLogUtils.createSpanId();

        // Override MDC with booking-specific IDs
        MDC.put("correlationId", correlationId);
        MDC.put("traceId", traceId);

        // Look up the pet to get owner info
        Pet pet = petStore.findById(request.petId())
                .orElse(null);

        String bookingId = bookingStore.nextId();

        // Create the ProcessLogger for this multi-step process
        ProcessLogger processLogger = eventLogTemplate.forProcess("CREATE_BOOKING")
                .withCorrelationId(correlationId)
                .withTraceId(traceId)
                .withSpanId(spanId)
                .addIdentifier("pet_id", request.petId())
                .addIdentifier("booking_id", bookingId);

        if (pet != null) {
            processLogger
                    .addIdentifier("owner_id", pet.ownerId())
                    .addMetadata("species", pet.species().name())
                    .addMetadata("breed", pet.breed())
                    .addMetadata("special_instructions", pet.specialInstructions());
        }

        // Step 0: PROCESS_START
        processLogger.processStart(
                EventLogUtils.generateSummary("Create", "booking", "started"),
                "BOOKING_STARTED");

        // Step 1: Validate Pet
        if (pet == null) {
            processLogger.error("PET_NOT_FOUND",
                    "Pet not found: " + request.petId(),
                    EventLogUtils.generateSummary("Create", "booking", "failed", "pet not found"),
                    "VALIDATION_FAILED");
            throw new PetNotFoundException(request.petId());
        }

        processLogger.logStep(1, "Validate Pet", EventStatus.SUCCESS,
                EventLogUtils.generateSummary("Validate", "pet", "passed"),
                "PET_VALID");

        // Step 2: Check Availability
        processLogger.logStep(2, "Check Availability", EventStatus.IN_PROGRESS,
                EventLogUtils.generateSummary("Check", "availability", "in progress"));

        // Simulate availability check (always available for demo)
        processLogger.logStep(2, "Check Availability", EventStatus.SUCCESS,
                EventLogUtils.generateSummary("Check", "availability", "confirmed"),
                "DATES_AVAILABLE");

        // Step 3: Confirm Booking
        Booking booking = new Booking(bookingId, request.petId(), pet.ownerId(),
                request.checkInDate(), request.checkOutDate());
        bookingStore.save(booking);

        processLogger.logStep(3, "Confirm Booking", EventStatus.SUCCESS,
                EventLogUtils.generateSummary("Confirm", "booking", "created"),
                "BOOKING_CONFIRMED");

        // Step 4: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.processEnd(4, EventStatus.SUCCESS,
                EventLogUtils.generateSummary("Create", "booking", "completed"),
                "BOOKING_CREATED", duration);

        // Create correlation link between this booking flow and the owner's account
        try {
            eventLogClient.createCorrelationLink(correlationId, pet.ownerId());
        } catch (Exception e) {
            log.warn("Failed to create correlation link: {}", e.getMessage());
        }

        log.info("Booking {} created for pet {} (owner {})", bookingId, request.petId(), pet.ownerId());
        return booking;
    }

    public Booking checkIn(String bookingId, CheckInRequest request) {
        long start = System.currentTimeMillis();
        String correlationId = MDC.get("correlationId");
        String traceId = MDC.get("traceId");
        String parentSpanId = MDC.get("spanId");

        Booking booking = bookingStore.findById(bookingId).orElse(null);

        ProcessLogger processLogger = eventLogTemplate.forProcess("CHECK_IN_PET")
                .withCorrelationId(correlationId)
                .withTraceId(traceId)
                .withParentSpanId(parentSpanId);

        // Step 0: PROCESS_START with request payload
        processLogger.addMetadata("request_payload",
                request != null && request.kennelPreference() != null
                        ? "{\"kennelPreference\":\"" + request.kennelPreference() + "\"}" : "{}");
        processLogger.processStart(
                EventLogUtils.generateSummary("Check in", "pet", "started"),
                "CHECK_IN_STARTED");

        // Step 1: Verify Booking
        if (booking == null) {
            processLogger.error("BOOKING_NOT_FOUND",
                    "Booking not found: " + bookingId,
                    EventLogUtils.generateSummary("Check in", "pet", "failed", "booking not found"));
            throw new BookingNotFoundException(bookingId);
        }

        if (booking.getStatus() != BookingStatus.PENDING) {
            processLogger.error("DOUBLE_CHECK_IN",
                    "Booking " + bookingId + " is already " + booking.getStatus(),
                    EventLogUtils.generateSummary("Check in", "pet", "failed", "invalid state"));
            throw new BookingConflictException(bookingId, "DOUBLE_CHECK_IN",
                    "Booking is already " + booking.getStatus());
        }

        processLogger.logStep(1, "Verify Booking", EventStatus.SUCCESS,
                EventLogUtils.generateSummary("Verify", "booking", "valid"),
                "BOOKING_VERIFIED");

        // Step 2: Assign Kennel (delegated to KennelService which uses @LogEvent)
        Pet pet = petStore.findById(booking.getPetId()).orElseThrow();
        String preference = request != null ? request.kennelPreference() : null;
        KennelService.KennelAssignment assignment = kennelService.assignKennel(pet.species(), preference);

        processLogger.addMetadata("kennel_number", assignment.kennelNumber());
        processLogger.addMetadata("kennel_zone", assignment.zone());

        // Step 3: Record Check-In
        booking.setStatus(BookingStatus.CHECKED_IN);
        booking.setKennelNumber(assignment.kennelNumber());
        booking.setCheckedInAt(Instant.now());
        bookingStore.save(booking);

        processLogger.addMetadata("response_payload",
                "{\"kennelNumber\":\"" + assignment.kennelNumber() + "\",\"status\":\"CHECKED_IN\"}");
        processLogger.logStep(3, "Record Check-In", EventStatus.SUCCESS,
                EventLogUtils.generateSummary("Record", "check-in", "completed",
                        "kennel " + assignment.kennelNumber()),
                "CHECK_IN_RECORDED");

        // Step 4: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.processEnd(4, EventStatus.SUCCESS,
                EventLogUtils.generateSummary("Check in", "pet", "completed",
                        pet.name() + " in kennel " + assignment.kennelNumber()),
                "CHECK_IN_COMPLETE", duration);

        log.info("Pet {} checked into kennel {}", booking.getPetId(), assignment.kennelNumber());
        return booking;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Approach 2: EventLogUtils static factories + AsyncEventLogger.log()
    // ──────────────────────────────────────────────────────────────────────

    public Booking checkOut(String bookingId, CheckOutRequest request) {
        long start = System.currentTimeMillis();
        String correlationId = MDC.get("correlationId");
        String traceId = MDC.get("traceId");
        String batchId = EventLogUtils.createBatchId("checkout");
        String appId = "pet-resort-api";
        String target = "PET_RESORT";
        String origin = "PET_RESORT";

        // Step 0: PROCESS_START via EventLogUtils
        EventLogEntry startEvent = EventLogUtils.processStart(
                        correlationId, traceId, "CHECK_OUT_PET",
                        appId, target, origin,
                        EventLogUtils.generateSummary("Check out", "pet", "started"),
                        "CHECK_OUT_STARTED")
                .batchId(batchId)
                .build();
        asyncEventLogger.log(startEvent);

        // Step 1: Verify Check-In
        Booking booking = bookingStore.findById(bookingId).orElse(null);

        if (booking == null) {
            EventLogEntry errorEvent = EventLogUtils.error(
                            correlationId, traceId, "CHECK_OUT_PET",
                            "BOOKING_NOT_FOUND", "Booking not found: " + bookingId,
                            appId, target, origin,
                            EventLogUtils.generateSummary("Check out", "pet", "failed"),
                            "NOT_FOUND")
                    .batchId(batchId)
                    .build();
            asyncEventLogger.log(errorEvent);
            throw new BookingNotFoundException(bookingId);
        }

        if (booking.getStatus() != BookingStatus.CHECKED_IN) {
            EventLogEntry errorEvent = EventLogUtils.error(
                            correlationId, traceId, "CHECK_OUT_PET",
                            "NOT_CHECKED_IN", "Booking " + bookingId + " is " + booking.getStatus(),
                            appId, target, origin,
                            EventLogUtils.generateSummary("Check out", "pet", "failed", "not checked in"),
                            "INVALID_STATE")
                    .batchId(batchId)
                    .build();
            asyncEventLogger.log(errorEvent);
            throw new BookingConflictException(bookingId, "NOT_CHECKED_IN",
                    "Booking must be CHECKED_IN to check out, was: " + booking.getStatus());
        }

        EventLogEntry verifyEvent = EventLogUtils.step(
                        correlationId, traceId, "CHECK_OUT_PET",
                        1, "Verify Check-In", EventStatus.SUCCESS,
                        appId, target, origin,
                        EventLogUtils.generateSummary("Verify", "check-in status", "confirmed"),
                        "VERIFIED")
                .batchId(batchId)
                .build();
        asyncEventLogger.log(verifyEvent);

        // Step 2: Process Payment — with maskLast4 and spanLinks
        String paymentSpanId = EventLogUtils.createSpanId();

        paymentService.processPayment(bookingId, request.paymentAmount(), request.cardNumberLast4());

        EventLogEntry paymentStep = EventLogUtils.step(
                        correlationId, traceId, "CHECK_OUT_PET",
                        2, "Process Payment", EventStatus.SUCCESS,
                        appId, target, origin,
                        EventLogUtils.generateSummary("Process", "payment", "completed",
                                request.paymentAmount() + " charged"),
                        "PAYMENT_SUCCESS")
                .batchId(batchId)
                .spanId(paymentSpanId)
                .spanLinks(List.of(traceId))
                .addMetadata("amount", request.paymentAmount().toString())
                .addMetadata("card_last4", EventLogUtils.maskLast4(request.cardNumberLast4()))
                .build();
        asyncEventLogger.log(paymentStep);

        // Step 3: Release Pet — with idempotencyKey
        booking.setStatus(BookingStatus.CHECKED_OUT);
        booking.setTotalAmount(request.paymentAmount());
        booking.setCheckedOutAt(Instant.now());
        bookingStore.save(booking);

        String idempotencyKey = "checkout-" + bookingId + "-" + Instant.now().getEpochSecond();
        EventLogEntry releaseEvent = EventLogUtils.step(
                        correlationId, traceId, "CHECK_OUT_PET",
                        3, "Release Pet", EventStatus.SUCCESS,
                        appId, target, origin,
                        EventLogUtils.generateSummary("Release", "pet", "released"),
                        "PET_RELEASED")
                .batchId(batchId)
                .idempotencyKey(idempotencyKey)
                .build();
        asyncEventLogger.log(releaseEvent);

        // Step 4: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        EventLogEntry endEvent = EventLogUtils.processEnd(
                        correlationId, traceId, "CHECK_OUT_PET",
                        4, EventStatus.SUCCESS, duration,
                        appId, target, origin,
                        EventLogUtils.generateSummary("Check out", "pet", "completed"),
                        "CHECK_OUT_COMPLETE")
                .batchId(batchId)
                .build();
        asyncEventLogger.log(endEvent);

        log.info("Booking {} checked out — total: {}", bookingId, request.paymentAmount());
        return booking;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Approach 3: @LogEvent annotation — simplest approach
    // ──────────────────────────────────────────────────────────────────────

    @LogEvent(process = "GET_BOOKING", step = 1, name = "Retrieve Booking",
              summary = "Retrieved booking details", result = "BOOKING_FOUND",
              failureSummary = "Booking not found", failureResult = "NOT_FOUND",
              errorCode = "BOOKING_NOT_FOUND")
    public Booking getBooking(String bookingId) {
        return bookingStore.findById(bookingId)
                .orElseThrow(() -> new BookingNotFoundException(bookingId));
    }

    public Collection<Booking> listBookings() {
        return bookingStore.findAll();
    }

    public Booking cancelBooking(String bookingId) {
        Booking booking = bookingStore.findById(bookingId)
                .orElseThrow(() -> new BookingNotFoundException(bookingId));

        if (booking.getStatus() == BookingStatus.CHECKED_OUT) {
            throw new BookingConflictException(bookingId, "ALREADY_CHECKED_OUT",
                    "Cannot cancel a checked-out booking");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        bookingStore.save(booking);

        // Direct logError() call — demonstrates template error shorthand
        String correlationId = MDC.get("correlationId");
        String traceId = MDC.get("traceId");
        eventLogTemplate.logError(
                correlationId, traceId, "CANCEL_BOOKING",
                "BOOKING_CANCELLED",
                "Booking " + bookingId + " cancelled by user",
                EventLogUtils.generateSummary("Cancel", "booking", "cancelled"));

        log.info("Booking {} cancelled", bookingId);
        return booking;
    }
}
