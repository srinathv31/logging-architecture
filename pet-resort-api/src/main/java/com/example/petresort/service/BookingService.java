package com.example.petresort.service;

import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.HttpMethod;
import com.eventlog.sdk.template.EventLogTemplate;
import com.eventlog.sdk.template.EventLogTemplate.ProcessLogger;
import com.eventlog.sdk.util.EventLogUtils;
import com.example.petresort.exception.BookingConflictException;
import com.example.petresort.exception.BookingNotFoundException;
import com.example.petresort.exception.KennelVendorTimeoutException;
import com.example.petresort.exception.PaymentFailedException;
import com.example.petresort.exception.PetNotFoundException;
import com.example.petresort.model.*;
import com.example.petresort.store.InMemoryBookingStore;
import com.example.petresort.store.InMemoryPetStore;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);

    private final InMemoryBookingStore bookingStore;
    private final InMemoryPetStore petStore;
    private final KennelService kennelService;
    private final PaymentService paymentService;
    private final EventLogTemplate eventLogTemplate;
    private final EventLogClient eventLogClient;

    private final Counter bookingsCreated;
    private final Counter checkinsCompleted;
    private final Counter checkoutsCompleted;
    private final Counter bookingsCancelled;

    public BookingService(InMemoryBookingStore bookingStore,
                          InMemoryPetStore petStore,
                          KennelService kennelService,
                          PaymentService paymentService,
                          EventLogTemplate eventLogTemplate,
                          EventLogClient eventLogClient,
                          MeterRegistry registry) {
        this.bookingStore = bookingStore;
        this.petStore = petStore;
        this.kennelService = kennelService;
        this.paymentService = paymentService;
        this.eventLogTemplate = eventLogTemplate;
        this.eventLogClient = eventLogClient;

        this.bookingsCreated = Counter.builder("petresort.bookings.created")
                .description("Total bookings created")
                .register(registry);
        this.checkinsCompleted = Counter.builder("petresort.checkins.completed")
                .description("Total check-ins completed")
                .register(registry);
        this.checkoutsCompleted = Counter.builder("petresort.checkouts.completed")
                .description("Total check-outs completed")
                .register(registry);
        this.bookingsCancelled = Counter.builder("petresort.bookings.cancelled")
                .description("Total bookings cancelled")
                .register(registry);
    }

    public Booking createBooking(CreateBookingRequest request) {
        long start = System.currentTimeMillis();

        // Preserve inbound correlation/trace IDs from the starter's MDC filter.
        // Only generate when missing (e.g., direct service call without HTTP layer).
        String correlationId = MDC.get("correlationId");
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = EventLogUtils.createCorrelationId("booking");
            MDC.put("correlationId", correlationId);
        }

        String traceId = MDC.get("traceId");
        if (traceId == null || traceId.isBlank()) {
            traceId = EventLogUtils.createTraceId();
            MDC.put("traceId", traceId);
        }

        String parentSpanId = MDC.get("spanId"); // inbound request span from MDC filter
        String spanId = EventLogUtils.createSpanId(); // Always fresh per operation

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
                .withParentSpanId(parentSpanId)
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
        processLogger.withEndpoint("/api/bookings")
                .withHttpMethod(HttpMethod.POST)
                .processStart(
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

        processLogger.logStep(1, "Validate Pet", EventStatus.SUCCESS,
                "Pet " + pet.name() + " (ID: " + pet.petId() + ", " + pet.species() + " - " + pet.breed() + ") validated for booking",
                "PET_VALID");

        // ── Branch based on X-Simulate header ──

        if ("kennel-timeout".equals(simulate)) {
            return createBookingKennelTimeout(processLogger, pet, bookingId);
        } else if ("kennel-retry".equals(simulate)) {
            return createBookingKennelRetry(processLogger, pet, bookingId, request, correlationId, traceId, start);
        } else if ("vet-warning".equals(simulate)) {
            return createBookingVetWarning(processLogger, pet, bookingId, request, correlationId, traceId, start);
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

        processLogger.logStep(2, "Kennel Availability Check", EventStatus.SUCCESS,
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

        final String corrId = correlationId;
        CompletableFuture.runAsync(() -> {
            try {
                eventLogClient.createCorrelationLink(corrId, pet.ownerId());
            } catch (Exception e) {
                log.warn("Failed to create correlation link: {}", e.getMessage());
            }
        });

        bookingsCreated.increment();
        log.info("Booking {} created for pet {} (owner {}) with kennel retry",
                bookingId, request.petId(), pet.ownerId());
        return booking;
    }

    /**
     * Scenario 11: Vet warning — booking succeeds but vet health check flags an expired avian vaccination
     */
    private Booking createBookingVetWarning(ProcessLogger processLogger, Pet pet, String bookingId,
                                             CreateBookingRequest request, String correlationId,
                                             String traceId, long start) {
        // Step 2: Kennel Availability Check
        processLogger.withTargetSystem("KENNEL_VENDOR");
        try { Thread.sleep(800); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(2, "Kennel Availability Check", EventStatus.SUCCESS,
                "Kennel availability confirmed via KENNEL_VENDOR for " + pet.species()
                        + " in zone " + getZone(pet.species()),
                "KENNEL_AVAILABLE");

        // Step 3: Veterinary Health Check — WARNING (expired avian vaccination)
        processLogger.withTargetSystem("VET_CHECK_API");
        try { Thread.sleep(1500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(3, "Veterinary Health Check", EventStatus.WARNING,
                "Expired avian vaccination for " + pet.name() + " — PBFD screening overdue by 45 days, "
                        + "boarding approved with monitoring advisory",
                "VET_WARNING");

        // Step 4: Confirm Booking (succeeds despite vet warning)
        Booking booking = new Booking(bookingId, request.petId(), pet.ownerId(),
                request.checkInDate(), request.checkOutDate());
        bookingStore.save(booking);

        processLogger.logStep(4, "Confirm Booking", EventStatus.SUCCESS,
                "Booking " + bookingId + " confirmed for " + pet.name() + " — "
                        + request.checkInDate() + " to " + request.checkOutDate()
                        + ", owner: " + pet.ownerId() + " (vet warning noted)",
                "BOOKING_CONFIRMED");

        // Step 5: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.withHttpStatusCode(201);
        processLogger.processEnd(5, EventStatus.SUCCESS,
                "Booking " + bookingId + " completed in " + duration + "ms — " + pet.name()
                        + " (" + pet.species() + ") booked successfully, vet warning flagged, owner " + pet.ownerId(),
                "BOOKING_CREATED", duration);

        final String corrId = correlationId;
        CompletableFuture.runAsync(() -> {
            try {
                eventLogClient.createCorrelationLink(corrId, pet.ownerId());
            } catch (Exception e) {
                log.warn("Failed to create correlation link: {}", e.getMessage());
            }
        });

        bookingsCreated.increment();
        log.info("Booking {} created for pet {} (owner {}) with vet warning",
                bookingId, request.petId(), pet.ownerId());
        return booking;
    }

    /**
     * Scenarios 1 & 4: Happy path — parallel kennel + vet checks, fork-join confirm with span_links
     */
    private Booking createBookingHappyPath(ProcessLogger processLogger, Pet pet, String bookingId,
                                            CreateBookingRequest request, String correlationId,
                                            String traceId, long start) {
        // targetSystem auto-reverts to template default (PET_RESORT) after each step.
        // Only set it when the step targets an external system.

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

        // Step 3: Confirm Booking with span_links referencing both parallel steps (fork-join).
        // This is the recommended pattern for joining parallel branches — withSpanLinks()
        // links this step back to the kennel and vet steps that ran concurrently.
        Booking booking = new Booking(bookingId, request.petId(), pet.ownerId(),
                request.checkInDate(), request.checkOutDate());
        bookingStore.save(booking);

        processLogger
            .withSpanLinks(List.of(kennelSpanId, vetSpanId))
            .addIdentifier("owner_id", pet.ownerId())
            .logStep(3, "Confirm Booking", EventStatus.SUCCESS,
                "Booking " + bookingId + " confirmed for " + pet.name() + " — "
                    + request.checkInDate() + " to " + request.checkOutDate()
                    + ", owner: " + pet.ownerId(),
                "BOOKING_CONFIRMED");

        // Step 4: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.withHttpStatusCode(201);
        processLogger.processEnd(4, EventStatus.SUCCESS,
                "Booking " + bookingId + " completed in " + duration + "ms — " + pet.name()
                        + " (" + pet.species() + ") booked successfully, owner " + pet.ownerId(),
                "BOOKING_CREATED", duration);

        // Create correlation link between this booking flow and the owner's account (async — off request thread)
        final String corrId = correlationId;
        CompletableFuture.runAsync(() -> {
            try {
                eventLogClient.createCorrelationLink(corrId, pet.ownerId());
            } catch (Exception e) {
                log.warn("Failed to create correlation link: {}", e.getMessage());
            }
        });

        bookingsCreated.increment();
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
                .withParentSpanId(parentSpanId);

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
        processLogger.withEndpoint("/api/bookings/" + bookingId + "/check-in")
                .withHttpMethod(HttpMethod.POST)
                .processStart(
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

        // Step 2: Assign Kennel
        String simulate = MDC.get("simulate");
        String preference = request != null ? request.kennelPreference() : null;
        KennelService.KennelAssignment assignment;

        if ("awaiting-approval".equals(simulate)) {
            return checkInAwaitingApproval(processLogger, booking, pet, bookingId);
        } else if ("agent-gate".equals(simulate)) {
            // Step 2: IN_PROGRESS — agent calling service center to verify room operability
            processLogger.withTargetSystem("FACILITIES_SERVICE_CENTER");
            processLogger.logStep(2, "Assign Kennel", EventStatus.IN_PROGRESS,
                    "Kennel in zone " + getZone(pet.species()) + " flagged for maintenance — "
                            + "agent calling facilities service center to verify room operability for "
                            + pet.name() + " (" + pet.species() + ")",
                    "AGENT_GATE_PENDING");
            String kennelStepSpanId = processLogger.getLastStepSpanId();

            // Simulate the agent's phone call (~2 min in real life, ~3s in demo)
            try { Thread.sleep(3000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

            assignment = kennelService.assignKennel(pet.species(), preference);

            // Step 2: SUCCESS with same spanId — room cleared, kennel assigned
            processLogger.withTargetSystem("KENNEL_VENDOR");
            processLogger.logStep(2, "Assign Kennel", EventStatus.SUCCESS,
                    "Facilities service center confirmed room operational — "
                            + pet.name() + " assigned to kennel " + assignment.kennelNumber()
                            + " (zone " + assignment.zone() + ")",
                    "KENNEL_ASSIGNED",
                    kennelStepSpanId);  // spanIdOverride — same spanId, status transition!
        } else {
            // Standard kennel assignment
            processLogger.withTargetSystem("KENNEL_VENDOR");
            try { Thread.sleep(600); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            assignment = kennelService.assignKennel(pet.species(), preference);
        }

        processLogger.addMetadata("kennel_number", assignment.kennelNumber());
        processLogger.addMetadata("kennel_zone", assignment.zone());

        // Step 3: Record Check-In
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

        checkinsCompleted.increment();
        log.info("Pet {} checked into kennel {}", booking.getPetId(), assignment.kennelNumber());
        return booking;
    }

    /**
     * Scenario 10: Boarding approval — check-in starts as IN_PROGRESS (awaitCompletion),
     * requires separate approval call to complete the process.
     */
    private Booking checkInAwaitingApproval(ProcessLogger processLogger, Booking booking, Pet pet, String bookingId) {
        processLogger.withAwaitCompletion();

        processLogger.processStart(
                "Initiating check-in for booking " + bookingId + " — awaiting vet diet approval for "
                        + pet.name() + " (" + pet.species() + ")",
                "CHECK_IN_AWAITING_APPROVAL");

        // Step 1: Verify Booking
        try { Thread.sleep(50); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        processLogger.logStep(1, "Verify Booking", EventStatus.SUCCESS,
                "Booking " + bookingId + " verified — " + pet.name() + " (" + pet.species()
                        + ") is PENDING check-in",
                "BOOKING_VERIFIED");

        // Step 2: Submit Vet Diet Approval — IN_PROGRESS
        processLogger.withTargetSystem("VET_DIET_APPROVAL");
        try { Thread.sleep(200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        processLogger.logStep(2, "Submit Vet Diet Approval", EventStatus.IN_PROGRESS,
                pet.name() + " has special dietary needs — vet diet approval submitted, awaiting review",
                "APPROVAL_PENDING");

        booking.setStatus(BookingStatus.AWAITING_APPROVAL);
        bookingStore.save(booking);

        processLogger.withHttpStatusCode(202);

        log.info("Booking {} check-in awaiting vet diet approval for pet {}", bookingId, booking.getPetId());
        return booking;
    }

    public Booking approveCheckIn(String bookingId) {
        long start = System.currentTimeMillis();
        String correlationId = MDC.get("correlationId");
        String traceId = MDC.get("traceId");
        String parentSpanId = MDC.get("spanId");

        Booking booking = bookingStore.findById(bookingId)
                .orElseThrow(() -> new BookingNotFoundException(bookingId));

        if (booking.getStatus() != BookingStatus.AWAITING_APPROVAL) {
            throw new BookingConflictException(bookingId, "NOT_AWAITING_APPROVAL",
                    "Booking must be AWAITING_APPROVAL to approve, was: " + booking.getStatus());
        }

        Pet pet = petStore.findById(booking.getPetId()).orElseThrow();

        ProcessLogger processLogger = eventLogTemplate.forProcess("CHECK_IN_PET")
                .withCorrelationId(correlationId)
                .withTraceId(traceId)
                .withParentSpanId(parentSpanId)
                .withAccountId(booking.getOwnerId())
                .addIdentifier("booking_id", bookingId)
                .addIdentifier("pet_id", booking.getPetId())
                .addIdentifier("owner_id", booking.getOwnerId());

        // Step 3: Vet Diet Approval Granted
        processLogger.withEndpoint("/api/bookings/" + bookingId + "/approve-check-in")
                .withHttpMethod(HttpMethod.POST)
                .withTargetSystem("VET_DIET_APPROVAL");
        try { Thread.sleep(100); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        processLogger.logStep(3, "Vet Diet Approval Granted", EventStatus.SUCCESS,
                "Vet diet approval granted for " + pet.name() + " — special dietary plan confirmed",
                "APPROVAL_GRANTED");

        // Step 4: Assign Kennel
        processLogger.withTargetSystem("KENNEL_VENDOR");
        try { Thread.sleep(600); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        KennelService.KennelAssignment assignment = kennelService.assignKennel(pet.species(), null);
        processLogger.addMetadata("kennel_number", assignment.kennelNumber());
        processLogger.addMetadata("kennel_zone", assignment.zone());
        processLogger.logStep(4, "Assign Kennel", EventStatus.SUCCESS,
                pet.name() + " assigned to kennel " + assignment.kennelNumber()
                        + " (zone " + assignment.zone() + ")",
                "KENNEL_ASSIGNED");

        // Step 5: Record Check-In
        try { Thread.sleep(80); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        booking.setStatus(BookingStatus.CHECKED_IN);
        booking.setKennelNumber(assignment.kennelNumber());
        booking.setCheckedInAt(Instant.now());
        bookingStore.save(booking);
        processLogger.logStep(5, "Record Check-In", EventStatus.SUCCESS,
                pet.name() + " (" + pet.species() + ") checked into kennel "
                        + assignment.kennelNumber() + " (zone " + assignment.zone() + ")",
                "CHECK_IN_RECORDED");

        // Step 6: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.withHttpStatusCode(200);
        processLogger.processEnd(6, EventStatus.SUCCESS,
                "Check-in completed in " + duration + "ms — " + pet.name()
                        + " is in kennel " + assignment.kennelNumber()
                        + " (vet diet approval flow)",
                "CHECK_IN_COMPLETE", duration);

        checkinsCompleted.increment();
        log.info("Booking {} approved — pet {} checked into kennel {}",
                bookingId, booking.getPetId(), assignment.kennelNumber());
        return booking;
    }

    public Booking checkOut(String bookingId, CheckOutRequest request) {
        long start = System.currentTimeMillis();
        String correlationId = MDC.get("correlationId");
        String traceId = MDC.get("traceId");
        String parentSpanId = MDC.get("spanId");

        Booking booking = bookingStore.findById(bookingId).orElse(null);
        Pet pet = booking != null ? petStore.findById(booking.getPetId()).orElse(null) : null;

        ProcessLogger processLogger = eventLogTemplate.forProcess("CHECK_OUT_PET")
                .withCorrelationId(correlationId)
                .withTraceId(traceId)
                .withParentSpanId(parentSpanId)
                .withBatchId(EventLogUtils.createBatchId("checkout"))
                .addIdentifier("booking_id", bookingId);

        if (booking != null) {
            processLogger.withAccountId(booking.getOwnerId());
        }

        // Step 0: PROCESS_START
        processLogger.withEndpoint("/api/bookings/" + bookingId + "/check-out")
                .withHttpMethod(HttpMethod.POST)
                .processStart(
                        "Initiating check-out for booking " + bookingId
                                + (pet != null ? " — " + pet.name() + " (" + pet.species() + ")" : ""),
                        "CHECK_OUT_STARTED");

        // Step 1: Verify Check-In
        if (booking == null) {
            processLogger.error("BOOKING_NOT_FOUND",
                    "Booking not found: " + bookingId,
                    "Check-out failed — booking " + bookingId + " does not exist",
                    "NOT_FOUND");
            throw new BookingNotFoundException(bookingId);
        }

        if (booking.getStatus() != BookingStatus.CHECKED_IN) {
            processLogger.error("NOT_CHECKED_IN",
                    "Booking " + bookingId + " is " + booking.getStatus(),
                    "Check-out failed — booking " + bookingId + " is " + booking.getStatus()
                            + ", expected CHECKED_IN",
                    "INVALID_STATE");
            throw new BookingConflictException(bookingId, "NOT_CHECKED_IN",
                    "Booking must be CHECKED_IN to check out, was: " + booking.getStatus());
        }

        processLogger
                .addIdentifier("pet_id", booking.getPetId())
                .addIdentifier("owner_id", booking.getOwnerId())
                .logStep(1, "Verify Check-In", EventStatus.SUCCESS,
                        "Booking " + bookingId + " verified — " + pet.name()
                                + " is CHECKED_IN at kennel " + booking.getKennelNumber(),
                        "VERIFIED");

        // Step 2: Process Payment
        String idempotencyKey = "checkout-" + bookingId + "-" + Instant.now().getEpochSecond();

        try {
            paymentService.processPayment(bookingId, request.paymentAmount(), request.cardNumberLast4());

            try { Thread.sleep(1200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

            processLogger
                    .withTargetSystem("STRIPE")
                    .withEndpoint("/v1/charges")
                    .withHttpMethod(HttpMethod.POST)
                    .withHttpStatusCode(200)
                    .withIdempotencyKey(idempotencyKey)
                    .withRequestPayload("{\"amount\":" + request.paymentAmount()
                            + ",\"currency\":\"USD\",\"card_last4\":\""
                            + EventLogUtils.maskLast4(request.cardNumberLast4())
                            + "\",\"booking_id\":\"" + bookingId + "\"}")
                    .withResponsePayload("{\"charge_id\":\"ch_" + bookingId.replace("BKG-", "")
                            + "\",\"status\":\"succeeded\",\"amount\":" + request.paymentAmount() + "}")
                    .addIdentifier("card_number_last4", EventLogUtils.maskLast4(request.cardNumberLast4()))
                    .addMetadata("amount", request.paymentAmount().toString())
                    .logStep(2, "Process Payment", EventStatus.SUCCESS,
                            "Payment of $" + request.paymentAmount() + " processed via STRIPE for booking "
                                    + bookingId + " — card ending ***" + request.cardNumberLast4(),
                            "PAYMENT_SUCCESS");

        } catch (PaymentFailedException e) {
            int failDuration = (int) (System.currentTimeMillis() - start);

            processLogger
                    .withTargetSystem("STRIPE")
                    .withEndpoint("/v1/charges")
                    .withHttpMethod(HttpMethod.POST)
                    .withHttpStatusCode(402)
                    .withErrorCode("PAYMENT_DECLINED")
                    .withErrorMessage(e.getMessage())
                    .logStep(2, "Process Payment", EventStatus.FAILURE,
                            "Payment of $" + request.paymentAmount() + " DECLINED for booking "
                                    + bookingId + " — " + e.getMessage(),
                            "PAYMENT_FAILED");

            processLogger.error("PAYMENT_FAILED", e.getMessage(),
                    "Check-out failed — payment declined for booking " + bookingId,
                    "PAYMENT_DECLINED");

            processLogger.withHttpStatusCode(422);
            processLogger.processEnd(3, EventStatus.FAILURE,
                    "Check-out FAILED in " + failDuration + "ms — payment declined for "
                            + pet.name() + ", booking " + bookingId,
                    "CHECK_OUT_FAILED", failDuration);

            throw e;
        }

        // Step 3: Generate Invoice
        try { Thread.sleep(400); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger
                .withTargetSystem("INVOICE_SERVICE")
                .logStep(3, "Generate Invoice", EventStatus.SUCCESS,
                        "Invoice generated for booking " + bookingId + " — total $"
                                + request.paymentAmount() + " for " + pet.name() + "'s stay",
                        "INVOICE_GENERATED");

        // Step 4: Release Kennel
        booking.setStatus(BookingStatus.CHECKED_OUT);
        booking.setTotalAmount(request.paymentAmount());
        booking.setCheckedOutAt(Instant.now());
        bookingStore.save(booking);

        try { Thread.sleep(300); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger
                .withTargetSystem("KENNEL_VENDOR")
                .logStep(4, "Release Kennel", EventStatus.SUCCESS,
                        "Kennel " + booking.getKennelNumber() + " released via KENNEL_VENDOR — "
                                + pet.name() + " checked out after stay",
                        "KENNEL_RELEASED");

        // Step 5: PROCESS_END
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.withHttpStatusCode(200);
        processLogger.processEnd(5, EventStatus.SUCCESS,
                "Check-out completed in " + duration + "ms — " + pet.name()
                        + " released from kennel " + booking.getKennelNumber()
                        + ", total $" + request.paymentAmount(),
                "CHECK_OUT_COMPLETE", duration);

        checkoutsCompleted.increment();
        log.info("Booking {} checked out — total: {}", bookingId, request.paymentAmount());
        return booking;
    }

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
        bookingsCancelled.increment();

        // Direct logError() call — demonstrates template error shorthand
        String correlationId = MDC.get("correlationId");
        String traceId = MDC.get("traceId");
        eventLogTemplate.logError(
                correlationId, traceId, "CANCEL_BOOKING",
                "BOOKING_CANCELLED",
                "Booking " + bookingId + " cancelled by user",
                "Cancel booking — cancelled");

        log.info("Booking {} cancelled", bookingId);
        return booking;
    }
}
