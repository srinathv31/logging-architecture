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
import com.example.petresort.exception.KennelVendorTimeoutException;
import com.example.petresort.exception.PetNotFoundException;
import com.example.petresort.model.*;
import com.example.petresort.store.InMemoryBookingStore;
import com.example.petresort.store.InMemoryPetStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

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
        String simulate = MDC.get("simulate");

        // Create the ProcessLogger for this multi-step process
        ProcessLogger processLogger = eventLogTemplate.forProcess("CREATE_BOOKING")
                .withCorrelationId(correlationId)
                .withTraceId(traceId)
                .withSpanId(spanId)
                .withEndpoint("/api/bookings")
                .withHttpMethod(HttpMethod.POST)
                .addIdentifier("pet_id", request.petId())
                .addIdentifier("booking_id", bookingId);

        if (pet != null) {
            processLogger
                    .withAccountId(pet.ownerId())
                    .addIdentifier("owner_id", pet.ownerId())
                    .addMetadata("species", pet.species().name())
                    .addMetadata("breed", pet.breed())
                    .addMetadata("pet_name", pet.name());
            if (pet.specialInstructions() != null) {
                processLogger.addMetadata("special_instructions", pet.specialInstructions());
            }
        }

        // Step 0: PROCESS_START
        processLogger.processStart(
                "Initiating booking " + bookingId + " for "
                        + (pet != null ? pet.name() + " (" + pet.species() + ")" : request.petId()),
                "BOOKING_STARTED");

        // Step 1: Validate Pet
        if (pet == null) {
            processLogger.error("PET_NOT_FOUND",
                    "Pet not found: " + request.petId(),
                    "Booking " + bookingId + " failed — pet " + request.petId() + " does not exist in the system",
                    "VALIDATION_FAILED");
            throw new PetNotFoundException(request.petId());
        }

        try { Thread.sleep(50); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.withTargetSystem("PET_RESORT");
        processLogger.logStep(1, "Validate Pet", EventStatus.SUCCESS,
                "Pet " + pet.name() + " (ID: " + pet.petId() + ", " + pet.species() + " - " + pet.breed() + ") validated for booking",
                "PET_VALID");

        // ── Branch based on X-Simulate header ──

        if ("kennel-timeout".equals(simulate)) {
            return createBookingKennelTimeout(processLogger, pet, bookingId);
        } else if ("kennel-retry".equals(simulate)) {
            return createBookingKennelRetry(processLogger, pet, bookingId, request, correlationId, traceId, start);
        } else {
            return createBookingHappyPath(processLogger, pet, bookingId, request, correlationId, traceId, start);
        }
    }

    /**
     * Scenario 2: Kennel vendor timeout — dedicated error, no PROCESS_END
     */
    private Booking createBookingKennelTimeout(ProcessLogger processLogger, Pet pet, String bookingId) {
        processLogger.withTargetSystem("KENNEL_VENDOR");
        try { Thread.sleep(2000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(2, "Kennel Availability Check", EventStatus.FAILURE,
                "Kennel vendor timed out after 2000ms while checking availability for " + pet.species()
                        + " — no response from KENNEL_VENDOR",
                "KENNEL_CHECK_TIMEOUT");

        processLogger.error("KENNEL_VENDOR_TIMEOUT",
                "Kennel vendor did not respond within 2000ms for pet " + pet.petId(),
                "Booking " + bookingId + " aborted — KENNEL_VENDOR unreachable, pet " + pet.name()
                        + " cannot be accommodated",
                "BOOKING_ABORTED");

        throw new KennelVendorTimeoutException(pet.petId(),
                "Kennel vendor timed out while checking availability for " + pet.name());
    }

    /**
     * Scenario 3: Kennel retry — attempt 1 fails, attempt 2 succeeds
     */
    private Booking createBookingKennelRetry(ProcessLogger processLogger, Pet pet, String bookingId,
                                              CreateBookingRequest request, String correlationId,
                                              String traceId, long start) {
        // Kennel Check — Attempt 1 (FAILURE)
        processLogger.withTargetSystem("KENNEL_VENDOR");
        processLogger.addMetadata("attempt", 1);
        try { Thread.sleep(800); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(2, "Kennel Availability Check", EventStatus.FAILURE,
                "No heat-lamp kennels available in zone D for " + pet.species()
                        + " — attempt 1 failed, expanding search area",
                "NO_HEATED_KENNELS");

        // Kennel Check — Attempt 2 (SUCCESS) — retryStep reuses stepSequence + stepName
        processLogger.addMetadata("attempt", 2);
        processLogger.addMetadata("expanded_search", true);
        try { Thread.sleep(1200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.retryStep(EventStatus.SUCCESS,
                "Heat-lamp kennel found in expanded zone D+ for " + pet.name() + " (" + pet.species()
                        + ") — attempt 2 succeeded",
                "KENNEL_AVAILABLE");

        // Vet Check
        processLogger.withTargetSystem("VET_CHECK_API");
        try { Thread.sleep(1500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(3, "Veterinary Health Check", EventStatus.SUCCESS,
                "Health clearance received from VET_CHECK_API for " + pet.name()
                        + " — reptile heat requirements noted",
                "VET_CLEARED");

        // Confirm Booking
        Booking booking = new Booking(bookingId, request.petId(), pet.ownerId(),
                request.checkInDate(), request.checkOutDate());
        bookingStore.save(booking);

        processLogger.withTargetSystem("PET_RESORT");
        processLogger.logStep(4, "Confirm Booking", EventStatus.SUCCESS,
                "Booking " + bookingId + " confirmed for " + pet.name() + " — "
                        + request.checkInDate() + " to " + request.checkOutDate()
                        + ", owner: " + pet.ownerId(),
                "BOOKING_CONFIRMED");

        // PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.withHttpStatusCode(201);
        processLogger.processEnd(5, EventStatus.SUCCESS,
                "Booking " + bookingId + " completed in " + duration + "ms — " + pet.name()
                        + " (" + pet.species() + ") booked with kennel retry, owner " + pet.ownerId(),
                "BOOKING_CREATED", duration);

        try {
            eventLogClient.createCorrelationLink(correlationId, pet.ownerId());
        } catch (Exception e) {
            log.warn("Failed to create correlation link: {}", e.getMessage());
        }

        log.info("Booking {} created for pet {} (owner {}) with kennel retry",
                bookingId, request.petId(), pet.ownerId());
        return booking;
    }

    /**
     * Scenarios 1 & 4: Happy path — parallel kennel + vet checks, fork-join confirm with span_links
     */
    private Booking createBookingHappyPath(ProcessLogger processLogger, Pet pet, String bookingId,
                                            CreateBookingRequest request, String correlationId,
                                            String traceId, long start) {
        // Step 2a: Kennel Availability Check (parallel)
        processLogger.withTargetSystem("KENNEL_VENDOR");
        try { Thread.sleep(800); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(2, "Kennel Availability Check", EventStatus.SUCCESS,
                "Kennel availability confirmed via KENNEL_VENDOR for " + pet.species()
                        + " in zone " + getZone(pet.species()),
                "KENNEL_AVAILABLE");
        String kennelSpanId = processLogger.getLastStepSpanId();

        // Step 2b: Veterinary Health Check (parallel — same step_sequence, different span_id)
        processLogger.withTargetSystem("VET_CHECK_API");
        try { Thread.sleep(700); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(2, "Veterinary Health Check", EventStatus.SUCCESS,
                "Health clearance received from VET_CHECK_API for " + pet.name()
                        + " — no conditions flagged",
                "VET_CLEARED");
        String vetSpanId = processLogger.getLastStepSpanId();

        // Step 3: Confirm Booking with span_links referencing both parallel steps (fork-join)
        Booking booking = new Booking(bookingId, request.petId(), pet.ownerId(),
                request.checkInDate(), request.checkOutDate());
        bookingStore.save(booking);

        // Use raw builder for span_links support (ProcessLogger doesn't expose spanLinks)
        String confirmSpanId = EventLogUtils.createSpanId();
        EventLogEntry confirmEvent = EventLogEntry.builder()
                .correlationId(correlationId)
                .traceId(traceId)
                .spanId(confirmSpanId)
                .parentSpanId(processLogger.getRootSpanId())
                .applicationId("pet-resort-api")
                .targetSystem("PET_RESORT")
                .originatingSystem("PET_RESORT")
                .processName("CREATE_BOOKING")
                .accountId(pet.ownerId())
                .stepSequence(3)
                .stepName("Confirm Booking")
                .eventType(EventType.STEP)
                .eventStatus(EventStatus.SUCCESS)
                .summary("Booking " + bookingId + " confirmed for " + pet.name() + " — "
                        + request.checkInDate() + " to " + request.checkOutDate()
                        + ", owner: " + pet.ownerId())
                .result("BOOKING_CONFIRMED")
                .spanLinks(List.of(kennelSpanId, vetSpanId))
                .addIdentifier("pet_id", request.petId())
                .addIdentifier("booking_id", bookingId)
                .addIdentifier("owner_id", pet.ownerId())
                .build();
        asyncEventLogger.log(confirmEvent);

        // Step 4: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.withTargetSystem("PET_RESORT");
        processLogger.withHttpStatusCode(201);
        processLogger.processEnd(4, EventStatus.SUCCESS,
                "Booking " + bookingId + " completed in " + duration + "ms — " + pet.name()
                        + " (" + pet.species() + ") booked successfully, owner " + pet.ownerId(),
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

    private static String getZone(PetSpecies species) {
        return switch (species) {
            case DOG -> "A";
            case CAT -> "B";
            case BIRD, RABBIT -> "C";
            case REPTILE -> "D";
        };
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
                .withParentSpanId(parentSpanId)
                .withEndpoint("/api/bookings/" + bookingId + "/check-in")
                .withHttpMethod(HttpMethod.POST);

        if (booking != null) {
            processLogger
                    .withAccountId(booking.getOwnerId())
                    .addIdentifier("booking_id", bookingId)
                    .addIdentifier("pet_id", booking.getPetId())
                    .addIdentifier("owner_id", booking.getOwnerId());
        }

        // Step 0: PROCESS_START with request payload
        processLogger.addMetadata("request_payload",
                request != null && request.kennelPreference() != null
                        ? "{\"kennelPreference\":\"" + request.kennelPreference() + "\"}" : "{}");
        processLogger.processStart(
                "Initiating check-in for booking " + bookingId,
                "CHECK_IN_STARTED");

        // Step 1: Verify Booking
        if (booking == null) {
            processLogger.error("BOOKING_NOT_FOUND",
                    "Booking not found: " + bookingId,
                    "Check-in failed — booking " + bookingId + " does not exist");
            throw new BookingNotFoundException(bookingId);
        }

        if (booking.getStatus() != BookingStatus.PENDING) {
            processLogger.error("DOUBLE_CHECK_IN",
                    "Booking " + bookingId + " is already " + booking.getStatus(),
                    "Check-in failed — booking " + bookingId + " is " + booking.getStatus()
                            + ", expected PENDING");
            throw new BookingConflictException(bookingId, "DOUBLE_CHECK_IN",
                    "Booking is already " + booking.getStatus());
        }

        Pet pet = petStore.findById(booking.getPetId()).orElseThrow();

        try { Thread.sleep(50); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(1, "Verify Booking", EventStatus.SUCCESS,
                "Booking " + bookingId + " verified — " + pet.name() + " (" + pet.species()
                        + ") is PENDING check-in",
                "BOOKING_VERIFIED");

        // Step 2: Assign Kennel (delegated to KennelService which uses @LogEvent)
        processLogger.withTargetSystem("KENNEL_VENDOR");
        try { Thread.sleep(600); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        String preference = request != null ? request.kennelPreference() : null;
        KennelService.KennelAssignment assignment = kennelService.assignKennel(pet.species(), preference);

        processLogger.addMetadata("kennel_number", assignment.kennelNumber());
        processLogger.addMetadata("kennel_zone", assignment.zone());

        // Step 3: Record Check-In
        processLogger.withTargetSystem("PET_RESORT");
        try { Thread.sleep(80); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        booking.setStatus(BookingStatus.CHECKED_IN);
        booking.setKennelNumber(assignment.kennelNumber());
        booking.setCheckedInAt(Instant.now());
        bookingStore.save(booking);

        processLogger.addMetadata("response_payload",
                "{\"kennelNumber\":\"" + assignment.kennelNumber() + "\",\"status\":\"CHECKED_IN\"}");
        processLogger.logStep(3, "Record Check-In", EventStatus.SUCCESS,
                pet.name() + " (" + pet.species() + ") checked into kennel "
                        + assignment.kennelNumber() + " (zone " + assignment.zone() + ")",
                "CHECK_IN_RECORDED");

        // Step 4: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.withHttpStatusCode(200);
        processLogger.processEnd(4, EventStatus.SUCCESS,
                "Check-in completed in " + duration + "ms — " + pet.name()
                        + " is in kennel " + assignment.kennelNumber(),
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
        String rootSpanId = EventLogUtils.createSpanId();
        String appId = "pet-resort-api";
        String origin = "PET_RESORT";

        Booking booking = bookingStore.findById(bookingId).orElse(null);
        Pet pet = booking != null ? petStore.findById(booking.getPetId()).orElse(null) : null;

        // Step 0: PROCESS_START via EventLogUtils
        EventLogEntry startEvent = EventLogUtils.processStart(
                        correlationId, traceId, "CHECK_OUT_PET",
                        appId, "PET_RESORT", origin,
                        "Initiating check-out for booking " + bookingId
                                + (pet != null ? " — " + pet.name() + " (" + pet.species() + ")" : ""),
                        "CHECK_OUT_STARTED")
                .batchId(batchId)
                .spanId(rootSpanId)
                .accountId(booking != null ? booking.getOwnerId() : null)
                .endpoint("/api/bookings/" + bookingId + "/check-out")
                .httpMethod(HttpMethod.POST)
                .addIdentifier("booking_id", bookingId)
                .build();
        asyncEventLogger.log(startEvent);

        // Step 1: Verify Check-In
        if (booking == null) {
            EventLogEntry errorEvent = EventLogUtils.error(
                            correlationId, traceId, "CHECK_OUT_PET",
                            "BOOKING_NOT_FOUND", "Booking not found: " + bookingId,
                            appId, "PET_RESORT", origin,
                            "Check-out failed — booking " + bookingId + " does not exist",
                            "NOT_FOUND")
                    .batchId(batchId)
                    .spanId(EventLogUtils.createSpanId())
                    .parentSpanId(rootSpanId)
                    .build();
            asyncEventLogger.log(errorEvent);
            throw new BookingNotFoundException(bookingId);
        }

        if (booking.getStatus() != BookingStatus.CHECKED_IN) {
            EventLogEntry errorEvent = EventLogUtils.error(
                            correlationId, traceId, "CHECK_OUT_PET",
                            "NOT_CHECKED_IN", "Booking " + bookingId + " is " + booking.getStatus(),
                            appId, "PET_RESORT", origin,
                            "Check-out failed — booking " + bookingId + " is " + booking.getStatus()
                                    + ", expected CHECKED_IN",
                            "INVALID_STATE")
                    .batchId(batchId)
                    .spanId(EventLogUtils.createSpanId())
                    .parentSpanId(rootSpanId)
                    .build();
            asyncEventLogger.log(errorEvent);
            throw new BookingConflictException(bookingId, "NOT_CHECKED_IN",
                    "Booking must be CHECKED_IN to check out, was: " + booking.getStatus());
        }

        EventLogEntry verifyEvent = EventLogUtils.step(
                        correlationId, traceId, "CHECK_OUT_PET",
                        1, "Verify Check-In", EventStatus.SUCCESS,
                        appId, "PET_RESORT", origin,
                        "Booking " + bookingId + " verified — " + pet.name()
                                + " is CHECKED_IN at kennel " + booking.getKennelNumber(),
                        "VERIFIED")
                .batchId(batchId)
                .spanId(EventLogUtils.createSpanId())
                .parentSpanId(rootSpanId)
                .accountId(booking.getOwnerId())
                .addIdentifier("booking_id", bookingId)
                .addIdentifier("pet_id", booking.getPetId())
                .addIdentifier("owner_id", booking.getOwnerId())
                .build();
        asyncEventLogger.log(verifyEvent);

        // Step 2a: Process Payment (STRIPE) — parallel with invoice
        String paymentSpanId = EventLogUtils.createSpanId();
        String idempotencyKey = "checkout-" + bookingId + "-" + Instant.now().getEpochSecond();

        paymentService.processPayment(bookingId, request.paymentAmount(), request.cardNumberLast4(), rootSpanId);

        try { Thread.sleep(1200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        EventLogEntry paymentStep = EventLogUtils.step(
                        correlationId, traceId, "CHECK_OUT_PET",
                        2, "Process Payment", EventStatus.SUCCESS,
                        appId, "STRIPE", origin,
                        "Payment of $" + request.paymentAmount() + " processed via STRIPE for booking "
                                + bookingId + " — card ending ***" + request.cardNumberLast4(),
                        "PAYMENT_SUCCESS")
                .batchId(batchId)
                .spanId(paymentSpanId)
                .parentSpanId(rootSpanId)
                .accountId(booking.getOwnerId())
                .idempotencyKey(idempotencyKey)
                .requestPayload("{\"amount\":" + request.paymentAmount()
                        + ",\"currency\":\"USD\",\"card_last4\":\""
                        + EventLogUtils.maskLast4(request.cardNumberLast4())
                        + "\",\"booking_id\":\"" + bookingId + "\"}")
                .responsePayload("{\"charge_id\":\"ch_" + bookingId.replace("BKG-", "")
                        + "\",\"status\":\"succeeded\",\"amount\":" + request.paymentAmount() + "}")
                .addIdentifier("booking_id", bookingId)
                .addIdentifier("card_number_last4", EventLogUtils.maskLast4(request.cardNumberLast4()))
                .addMetadata("amount", request.paymentAmount().toString())
                .build();
        asyncEventLogger.log(paymentStep);

        // Step 2b: Generate Invoice (PET_RESORT) — parallel with payment
        String invoiceSpanId = EventLogUtils.createSpanId();
        try { Thread.sleep(400); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        EventLogEntry invoiceStep = EventLogUtils.step(
                        correlationId, traceId, "CHECK_OUT_PET",
                        2, "Generate Invoice", EventStatus.SUCCESS,
                        appId, "PET_RESORT", origin,
                        "Invoice generated for booking " + bookingId + " — total $"
                                + request.paymentAmount() + " for " + pet.name() + "'s stay",
                        "INVOICE_GENERATED")
                .batchId(batchId)
                .spanId(invoiceSpanId)
                .parentSpanId(rootSpanId)
                .accountId(booking.getOwnerId())
                .addIdentifier("booking_id", bookingId)
                .build();
        asyncEventLogger.log(invoiceStep);

        // Step 3: Release Kennel — with span_links referencing payment and invoice (fork-join)
        booking.setStatus(BookingStatus.CHECKED_OUT);
        booking.setTotalAmount(request.paymentAmount());
        booking.setCheckedOutAt(Instant.now());
        bookingStore.save(booking);

        try { Thread.sleep(300); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        EventLogEntry releaseEvent = EventLogUtils.step(
                        correlationId, traceId, "CHECK_OUT_PET",
                        3, "Release Kennel", EventStatus.SUCCESS,
                        appId, "KENNEL_VENDOR", origin,
                        "Kennel " + booking.getKennelNumber() + " released via KENNEL_VENDOR — "
                                + pet.name() + " checked out after stay",
                        "KENNEL_RELEASED")
                .batchId(batchId)
                .spanId(EventLogUtils.createSpanId())
                .parentSpanId(rootSpanId)
                .accountId(booking.getOwnerId())
                .spanLinks(List.of(paymentSpanId, invoiceSpanId))
                .addIdentifier("booking_id", bookingId)
                .build();
        asyncEventLogger.log(releaseEvent);

        // Step 4: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        EventLogEntry endEvent = EventLogUtils.processEnd(
                        correlationId, traceId, "CHECK_OUT_PET",
                        4, EventStatus.SUCCESS, duration,
                        appId, "PET_RESORT", origin,
                        "Check-out completed in " + duration + "ms — " + pet.name()
                                + " released from kennel " + booking.getKennelNumber()
                                + ", total $" + request.paymentAmount(),
                        "CHECK_OUT_COMPLETE")
                .batchId(batchId)
                .spanId(EventLogUtils.createSpanId())
                .parentSpanId(rootSpanId)
                .accountId(booking.getOwnerId())
                .httpStatusCode(200)
                .addIdentifier("booking_id", bookingId)
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
