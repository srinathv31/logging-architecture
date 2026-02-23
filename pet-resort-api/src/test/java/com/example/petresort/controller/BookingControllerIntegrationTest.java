package com.example.petresort.controller;

import com.eventlog.sdk.client.EventLogClient;
import com.eventlog.sdk.client.MockAsyncEventLogger;
import com.eventlog.sdk.client.transport.EventLogRequest;
import com.eventlog.sdk.client.transport.EventLogResponse;
import com.eventlog.sdk.client.transport.EventLogTransport;
import com.eventlog.sdk.model.EventLogEntry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BookingControllerIntegrationTest {
    private static final String CORRELATION_LINK_OK =
            "{\"success\":true,\"correlation_id\":\"corr-test\",\"account_id\":\"acc-test\",\"linked_at\":\"2026-01-01T00:00:00Z\"}";

    @TestConfiguration
    static class TestConfig {
        @Bean
        @Primary
        EventLogClient testEventLogClient() {
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

        @Bean
        @Primary
        MockAsyncEventLogger testMockAsyncEventLogger() {
            return new MockAsyncEventLogger();
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MockAsyncEventLogger mockAsyncEventLogger;

    @BeforeEach
    void setUp() {
        mockAsyncEventLogger.reset();
    }

    @Test
    void createBooking_withInboundCorrelationHeader() throws Exception {
        String requestBody = """
                {
                    "petId": "PET-001",
                    "checkInDate": "%s",
                    "checkOutDate": "%s"
                }
                """.formatted(
                LocalDate.now().plusDays(1),
                LocalDate.now().plusDays(5));

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Correlation-Id", "test-corr-123")
                        .header("X-Trace-Id", "test-trace-456")
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andExpect(header().string("X-Correlation-Id", "test-corr-123"))
                .andExpect(jsonPath("$.bookingId").isNotEmpty());

        // Verify captured events use the inbound correlation ID
        List<EventLogEntry> events = mockAsyncEventLogger.getCapturedEvents();
        assertFalse(events.isEmpty(), "Expected captured events from booking creation");

        for (EventLogEntry event : events) {
            assertEquals("test-corr-123", event.getCorrelationId(),
                    "Event '" + event.getResult() + "' should use inbound correlationId");
            assertEquals("test-trace-456", event.getTraceId(),
                    "Event '" + event.getResult() + "' should use inbound traceId");
        }
    }

    @Test
    void createBooking_withoutHeaders() throws Exception {
        String requestBody = """
                {
                    "petId": "PET-001",
                    "checkInDate": "%s",
                    "checkOutDate": "%s"
                }
                """.formatted(
                LocalDate.now().plusDays(1),
                LocalDate.now().plusDays(5));

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andExpect(header().exists("X-Correlation-Id"))
                .andExpect(jsonPath("$.bookingId").isNotEmpty());

        // Verify events have auto-generated non-null IDs
        List<EventLogEntry> events = mockAsyncEventLogger.getCapturedEvents();
        assertFalse(events.isEmpty(), "Expected captured events from booking creation");

        for (EventLogEntry event : events) {
            assertNotNull(event.getCorrelationId(),
                    "Event '" + event.getResult() + "' should have auto-generated correlationId");
            assertNotNull(event.getTraceId(),
                    "Event '" + event.getResult() + "' should have auto-generated traceId");
        }
    }
}
