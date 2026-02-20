package com.example.petresort.service;

import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.MockAsyncEventLogger;
import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.client.transport.EventLogResponse;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.template.EventLogTemplate;
import com.example.petresort.model.*;
import com.example.petresort.store.InMemoryBookingStore;
import com.example.petresort.store.InMemoryPetStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;

class BookingServiceTest {
    private static final String CORRELATION_LINK_OK =
            "{\"success\":true,\"correlation_id\":\"corr-test\",\"account_id\":\"acc-test\",\"linked_at\":\"2026-01-01T00:00:00Z\"}";

    private InMemoryBookingStore bookingStore;
    private InMemoryPetStore petStore;
    private MockAsyncEventLogger mockEventLogger;
    private BookingService bookingService;

    @BeforeEach
    void setUp() {
        bookingStore = new InMemoryBookingStore();
        petStore = new InMemoryPetStore();
        KennelService kennelService = new KennelService();
        mockEventLogger = new MockAsyncEventLogger();

        EventLogTemplate eventLogTemplate = EventLogTemplate.builder(mockEventLogger)
                .applicationId("pet-resort-api-test")
                .targetSystem("PET_RESORT")
                .originatingSystem("PET_RESORT")
                .build();

        PaymentService paymentService = new PaymentService(
                mockEventLogger, "pet-resort-api-test", "PET_RESORT", "PET_RESORT");

        EventLogClient eventLogClient = stubEventLogClient();

        bookingService = new BookingService(
                bookingStore, petStore, kennelService, paymentService,
                eventLogTemplate, mockEventLogger, eventLogClient);

        // Seed a test pet
        petStore.save(new Pet("PET-001", "Buddy", PetSpecies.DOG, "Golden Retriever", 3, "OWN-001", null));
    }

    @AfterEach
    void tearDown() {
        MDC.clear();
        mockEventLogger.reset();
    }

    private EventLogClient stubEventLogClient() {
        EventLogTransport transport = new EventLogTransport() {
            @Override
            public EventLogResponse send(EventLogRequest request) {
                return new EventLogResponse(201, CORRELATION_LINK_OK);
            }

            @Override
            public CompletableFuture<EventLogResponse> sendAsync(EventLogRequest request) {
                return CompletableFuture.completedFuture(new EventLogResponse(201, CORRELATION_LINK_OK));
            }
        };

        return EventLogClient.builder()
                .baseUrl("http://eventlog.test")
                .transport(transport)
                .maxRetries(0)
                .build();
    }

    @Test
    void createBooking_preservesInboundCorrelationId() {
        // Given: MDC is populated with inbound correlation/trace IDs (as the MDC filter would do)
        MDC.put("correlationId", "test-corr-inbound");
        MDC.put("traceId", "test-trace-inbound");

        CreateBookingRequest request = new CreateBookingRequest(
                "PET-001", LocalDate.now().plusDays(1), LocalDate.now().plusDays(5));

        // When
        bookingService.createBooking(request);

        // Then: all captured events use the inbound IDs, not newly generated ones
        List<EventLogEntry> events = mockEventLogger.getCapturedEvents();
        assertFalse(events.isEmpty(), "Expected captured events");

        for (EventLogEntry event : events) {
            assertEquals("test-corr-inbound", event.getCorrelationId(),
                    "Event '" + event.getResult() + "' should preserve inbound correlationId");
            assertEquals("test-trace-inbound", event.getTraceId(),
                    "Event '" + event.getResult() + "' should preserve inbound traceId");
        }
    }

    @Test
    void createBooking_generatesIdsWhenMdcEmpty() {
        // Given: MDC is empty (e.g., direct service call without HTTP layer)
        CreateBookingRequest request = new CreateBookingRequest(
                "PET-001", LocalDate.now().plusDays(1), LocalDate.now().plusDays(5));

        // When
        bookingService.createBooking(request);

        // Then: events have auto-generated non-null IDs
        List<EventLogEntry> events = mockEventLogger.getCapturedEvents();
        assertFalse(events.isEmpty(), "Expected captured events");

        for (EventLogEntry event : events) {
            assertNotNull(event.getCorrelationId(),
                    "Event '" + event.getResult() + "' should have generated correlationId");
            assertNotNull(event.getTraceId(),
                    "Event '" + event.getResult() + "' should have generated traceId");
        }
    }

    @Test
    void createBookingHappyPath_setsSpanLinks() {
        // Given
        MDC.put("correlationId", "corr-span-test");
        MDC.put("traceId", "trace-span-test");

        CreateBookingRequest request = new CreateBookingRequest(
                "PET-001", LocalDate.now().plusDays(1), LocalDate.now().plusDays(5));

        // When
        bookingService.createBooking(request);

        // Then: the "Confirm Booking" step should have spanLinks containing kennel and vet span IDs
        List<EventLogEntry> events = mockEventLogger.getCapturedEvents();

        // Find the "Confirm Booking" step
        EventLogEntry confirmStep = events.stream()
                .filter(e -> "BOOKING_CONFIRMED".equals(e.getResult()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Expected a BOOKING_CONFIRMED event"));

        assertNotNull(confirmStep.getSpanLinks(), "Confirm Booking should have spanLinks");
        assertEquals(2, confirmStep.getSpanLinks().size(),
                "Confirm Booking should link to kennel and vet spans");

        // Find the kennel and vet step span IDs
        EventLogEntry kennelStep = events.stream()
                .filter(e -> "KENNEL_AVAILABLE".equals(e.getResult()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Expected a KENNEL_AVAILABLE event"));

        EventLogEntry vetStep = events.stream()
                .filter(e -> "VET_CLEARED".equals(e.getResult()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Expected a VET_CLEARED event"));

        assertTrue(confirmStep.getSpanLinks().contains(kennelStep.getSpanId()),
                "spanLinks should contain kennel step spanId");
        assertTrue(confirmStep.getSpanLinks().contains(vetStep.getSpanId()),
                "spanLinks should contain vet step spanId");
    }

    @Test
    void createBooking_linksInboundSpanAsParent() {
        // Given: MDC has an inbound spanId (set by the starter's MDC filter)
        MDC.put("correlationId", "corr-parent-test");
        MDC.put("traceId", "trace-parent-test");
        MDC.put("spanId", "inbound-span-123");

        Pet pet = new Pet("PET-002", "Whiskers", PetSpecies.CAT, "Siamese", 5, "OWN-001", null);
        petStore.save(pet);

        CreateBookingRequest request = new CreateBookingRequest(
                "PET-002", LocalDate.now().plusDays(1), LocalDate.now().plusDays(5));

        // When
        bookingService.createBooking(request);

        // Then: PROCESS_START event should have parentSpanId = inbound span, and a different spanId
        List<EventLogEntry> events = mockEventLogger.getCapturedEvents();
        EventLogEntry startEvent = events.stream()
                .filter(e -> "BOOKING_STARTED".equals(e.getResult()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Expected a BOOKING_STARTED event"));

        assertEquals("inbound-span-123", startEvent.getParentSpanId(),
                "PROCESS_START should link to inbound request span as parent");
        assertNotEquals("inbound-span-123", startEvent.getSpanId(),
                "PROCESS_START should have its own fresh spanId, not the inbound one");
    }
}
