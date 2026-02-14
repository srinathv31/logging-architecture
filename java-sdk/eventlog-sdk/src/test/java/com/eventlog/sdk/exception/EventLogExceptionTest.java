package com.eventlog.sdk.exception;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EventLogExceptionTest {

    @Test
    void messageOnlyConstructor() {
        EventLogException ex = new EventLogException("Something went wrong");
        assertEquals("Something went wrong", ex.getMessage());
        assertEquals(0, ex.getStatusCode());
        assertNull(ex.getErrorCode());
        assertNull(ex.getCause());
    }

    @Test
    void messageAndCauseConstructor() {
        RuntimeException cause = new RuntimeException("root cause");
        EventLogException ex = new EventLogException("Wrapped error", cause);
        assertEquals("Wrapped error", ex.getMessage());
        assertEquals(0, ex.getStatusCode());
        assertNull(ex.getErrorCode());
        assertSame(cause, ex.getCause());
    }

    @Test
    void statusCodeAndErrorCodeConstructor() {
        EventLogException ex = new EventLogException("API error", 404, "NOT_FOUND");
        assertEquals("API error", ex.getMessage());
        assertEquals(404, ex.getStatusCode());
        assertEquals("NOT_FOUND", ex.getErrorCode());
        assertNull(ex.getCause());
    }

    @Test
    void fullConstructorWithCause() {
        RuntimeException cause = new RuntimeException("network failure");
        EventLogException ex = new EventLogException("Request failed", 500, "INTERNAL", cause);
        assertEquals("Request failed", ex.getMessage());
        assertEquals(500, ex.getStatusCode());
        assertEquals("INTERNAL", ex.getErrorCode());
        assertSame(cause, ex.getCause());
    }

    @Test
    void nullErrorCodeIsAllowed() {
        EventLogException ex = new EventLogException("Error", 400, null);
        assertNull(ex.getErrorCode());
        assertEquals(400, ex.getStatusCode());
    }
}
