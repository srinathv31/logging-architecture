package com.eventlog.sdk.autoconfigure.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class EventLogMdcFilterTest {

    private EventLogMdcFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        filter = new EventLogMdcFilter("X-Correlation-Id", "X-Trace-Id", "X-Span-Id");
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        MDC.clear();
    }

    @Test
    void populatesMdcFromHeaders() throws ServletException, IOException {
        request.addHeader("X-Correlation-Id", "corr-from-header");
        request.addHeader("X-Trace-Id", "trace-from-header");
        request.addHeader("X-Span-Id", "span-from-header");

        Map<String, String> capturedMdc = new HashMap<>();
        FilterChain chain = (req, res) -> capturedMdc.putAll(MDC.getCopyOfContextMap());

        filter.doFilter(request, response, chain);

        assertEquals("corr-from-header", capturedMdc.get("correlationId"));
        assertEquals("trace-from-header", capturedMdc.get("traceId"));
        assertEquals("span-from-header", capturedMdc.get("spanId"));

        // Verify response headers echoed back
        assertEquals("corr-from-header", response.getHeader("X-Correlation-Id"));
        assertEquals("trace-from-header", response.getHeader("X-Trace-Id"));
        assertEquals("span-from-header", response.getHeader("X-Span-Id"));
    }

    @Test
    void generatesMissingIds() throws ServletException, IOException {
        // No headers set — filter should generate IDs
        Map<String, String> capturedMdc = new HashMap<>();
        FilterChain chain = (req, res) -> capturedMdc.putAll(MDC.getCopyOfContextMap());

        filter.doFilter(request, response, chain);

        assertNotNull(capturedMdc.get("correlationId"), "Should generate correlationId");
        assertNotNull(capturedMdc.get("traceId"), "Should generate traceId");
        assertNotNull(capturedMdc.get("spanId"), "Should generate spanId");
        assertFalse(capturedMdc.get("correlationId").isBlank());
        assertFalse(capturedMdc.get("traceId").isBlank());
        assertFalse(capturedMdc.get("spanId").isBlank());

        // Response headers should also be set
        assertNotNull(response.getHeader("X-Correlation-Id"));
        assertNotNull(response.getHeader("X-Trace-Id"));
        assertNotNull(response.getHeader("X-Span-Id"));
    }

    @Test
    void removesMdcKeysAfterRequest() throws ServletException, IOException {
        request.addHeader("X-Correlation-Id", "corr-123");
        request.addHeader("X-Trace-Id", "trace-123");
        request.addHeader("X-Span-Id", "span-123");

        FilterChain chain = (req, res) -> {
            // MDC should be populated during filter chain
            assertNotNull(MDC.get("correlationId"));
        };

        filter.doFilter(request, response, chain);

        // After filter completes, eventlog MDC keys should be removed
        assertNull(MDC.get("correlationId"), "correlationId should be removed after request");
        assertNull(MDC.get("traceId"), "traceId should be removed after request");
        assertNull(MDC.get("spanId"), "spanId should be removed after request");
    }

    @Test
    void preservesExternalMdcKeys() throws ServletException, IOException {
        // Set an external MDC key before calling the filter
        MDC.put("tenant", "acme");

        request.addHeader("X-Correlation-Id", "corr-123");

        FilterChain chain = (req, res) -> {
            // Both external and filter keys should be visible during chain
            assertEquals("acme", MDC.get("tenant"));
            assertNotNull(MDC.get("correlationId"));
        };

        filter.doFilter(request, response, chain);

        // External key should survive
        assertEquals("acme", MDC.get("tenant"), "External MDC keys should be preserved");

        // Filter keys should be removed
        assertNull(MDC.get("correlationId"), "correlationId should be removed");
        assertNull(MDC.get("traceId"), "traceId should be removed");
        assertNull(MDC.get("spanId"), "spanId should be removed");
    }

    @Test
    void customHeaderNames() throws ServletException, IOException {
        EventLogMdcFilter customFilter = new EventLogMdcFilter(
                "X-Custom-Corr", "X-Custom-Trace", "X-Custom-Span");

        request.addHeader("X-Custom-Corr", "custom-corr");
        request.addHeader("X-Custom-Trace", "custom-trace");
        request.addHeader("X-Custom-Span", "custom-span");

        Map<String, String> capturedMdc = new HashMap<>();
        FilterChain chain = (req, res) -> capturedMdc.putAll(MDC.getCopyOfContextMap());

        customFilter.doFilter(request, response, chain);

        assertEquals("custom-corr", capturedMdc.get("correlationId"));
        assertEquals("custom-trace", capturedMdc.get("traceId"));
        assertEquals("custom-span", capturedMdc.get("spanId"));
    }
}
