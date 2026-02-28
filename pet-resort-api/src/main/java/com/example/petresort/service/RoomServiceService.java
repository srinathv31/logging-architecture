package com.example.petresort.service;

import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.HttpMethod;
import com.eventlog.sdk.template.EventLogTemplate;
import com.eventlog.sdk.template.EventLogTemplate.ProcessLogger;
import com.example.petresort.exception.BookingNotFoundException;
import com.example.petresort.exception.PetNotFoundException;
import com.example.petresort.model.*;
import com.example.petresort.store.InMemoryBookingStore;
import com.example.petresort.store.InMemoryOwnerStore;
import com.example.petresort.store.InMemoryPetStore;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicInteger;

@Service
public class RoomServiceService {

    private static final Logger log = LoggerFactory.getLogger(RoomServiceService.class);

    private final InMemoryBookingStore bookingStore;
    private final InMemoryPetStore petStore;
    private final InMemoryOwnerStore ownerStore;
    private final EventLogTemplate eventLogTemplate;
    private final AtomicInteger orderSequence = new AtomicInteger(1);

    private final Counter roomServiceOrders;

    public RoomServiceService(InMemoryBookingStore bookingStore,
                              InMemoryPetStore petStore,
                              InMemoryOwnerStore ownerStore,
                              EventLogTemplate eventLogTemplate,
                              MeterRegistry registry) {
        this.bookingStore = bookingStore;
        this.petStore = petStore;
        this.ownerStore = ownerStore;
        this.eventLogTemplate = eventLogTemplate;

        this.roomServiceOrders = Counter.builder("petresort.roomservice.orders")
                .description("Total room service orders fulfilled")
                .register(registry);
    }

    public RoomServiceResponse fulfillRoomService(RoomServiceRequest request) {
        long start = System.currentTimeMillis();
        String simulate = MDC.get("simulate");
        String correlationId = MDC.get("correlationId");
        String traceId = MDC.get("traceId");
        String orderId = "ORD-%03d".formatted(orderSequence.getAndIncrement());

        // Look up entities
        Pet pet = petStore.findById(request.petId())
                .orElseThrow(() -> new PetNotFoundException(request.petId()));
        Booking booking = bookingStore.findById(request.bookingId())
                .orElseThrow(() -> new BookingNotFoundException(request.bookingId()));
        Owner owner = ownerStore.findById(pet.ownerId()).orElse(null);

        ProcessLogger processLogger = eventLogTemplate.forProcess("ROOM_SERVICE_ORDER")
                .withCorrelationId(correlationId)
                .withTraceId(traceId)
                .withAccountId(pet.ownerId())
                .addIdentifier("order_id", orderId)
                .addIdentifier("pet_id", request.petId())
                .addIdentifier("booking_id", request.bookingId())
                .addIdentifier("owner_id", pet.ownerId());

        // Step 0: PROCESS_START
        processLogger.withEndpoint("/api/room-service")
                .withHttpMethod(HttpMethod.POST)
                .processStart(
                "Room service order " + orderId + " initiated for " + pet.name()
                        + " — " + request.quantity() + "x " + request.item(),
                "ORDER_STARTED");

        // Step 1: Account Lookup
        if ("account-retry".equals(simulate)) {
            // Attempt 1: FAILURE
            processLogger.addMetadata("attempt", 1);
            try { Thread.sleep(200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

            processLogger.logStep(1, "Account Lookup", EventStatus.FAILURE,
                    "Account lookup failed for owner " + pet.ownerId()
                            + " — connection reset, retrying",
                    "ACCOUNT_LOOKUP_FAILED");

            // Attempt 2: SUCCESS — retryStep reuses stepSequence + stepName
            processLogger.addMetadata("attempt", 2);
            try { Thread.sleep(150); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

            processLogger.logStep(1, "Account Lookup", EventStatus.SUCCESS,
                    "Account " + pet.ownerId() + " verified on retry — "
                            + (owner != null ? owner.name() : "unknown")
                            + ", active booking " + request.bookingId(),
                    "ACCOUNT_VERIFIED");
        } else {
            try { Thread.sleep(150); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

            processLogger.logStep(1, "Account Lookup", EventStatus.SUCCESS,
                    "Account " + pet.ownerId() + " verified — "
                            + (owner != null ? owner.name() : "unknown")
                            + ", active booking " + request.bookingId(),
                    "ACCOUNT_VERIFIED");
        }

        // Step 2: Check Inventory
        processLogger.withTargetSystem("INVENTORY_SERVICE");
        try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(2, "Check Inventory", EventStatus.SUCCESS,
                request.quantity() + "x " + request.item()
                        + " available in INVENTORY_SERVICE — sufficient stock for order " + orderId,
                "INVENTORY_AVAILABLE");

        // Step 3: Fulfill Order
        try { Thread.sleep(800); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        processLogger.logStep(3, "Fulfill Order", EventStatus.SUCCESS,
                "Order " + orderId + " fulfilled — " + request.quantity() + "x " + request.item()
                        + " delivered to kennel " + booking.getKennelNumber() + " for " + pet.name(),
                "ORDER_FULFILLED");

        // Step 4: PROCESS_END
        processLogger.withHttpStatusCode(201);
        int duration = (int) (System.currentTimeMillis() - start);
        processLogger.processEnd(4, EventStatus.SUCCESS,
                "Room service order " + orderId + " completed in " + duration + "ms — "
                        + pet.name() + " received " + request.quantity() + "x " + request.item(),
                "ORDER_COMPLETE", duration);

        roomServiceOrders.increment();
        log.info("Room service order {} fulfilled for pet {} in kennel {}",
                orderId, request.petId(), booking.getKennelNumber());

        return new RoomServiceResponse(orderId, request.petId(), request.bookingId(),
                booking.getKennelNumber(), request.item(), request.quantity(), "FULFILLED");
    }
}
