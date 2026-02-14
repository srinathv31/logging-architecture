package com.eventlog.sdk.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EnumTest {

    @Test
    void eventStatusFromValueAllValues() {
        assertEquals(EventStatus.SUCCESS, EventStatus.fromValue("SUCCESS"));
        assertEquals(EventStatus.FAILURE, EventStatus.fromValue("FAILURE"));
        assertEquals(EventStatus.IN_PROGRESS, EventStatus.fromValue("IN_PROGRESS"));
        assertEquals(EventStatus.SKIPPED, EventStatus.fromValue("SKIPPED"));
    }

    @Test
    void eventStatusFromValueCaseInsensitive() {
        assertEquals(EventStatus.SUCCESS, EventStatus.fromValue("success"));
        assertEquals(EventStatus.FAILURE, EventStatus.fromValue("Failure"));
    }

    @Test
    void eventStatusFromValueThrowsOnUnknown() {
        assertThrows(IllegalArgumentException.class, () -> EventStatus.fromValue("UNKNOWN"));
    }

    @Test
    void eventStatusGetValue() {
        assertEquals("SUCCESS", EventStatus.SUCCESS.getValue());
        assertEquals("FAILURE", EventStatus.FAILURE.getValue());
        assertEquals("IN_PROGRESS", EventStatus.IN_PROGRESS.getValue());
        assertEquals("SKIPPED", EventStatus.SKIPPED.getValue());
    }

    @Test
    void eventTypeFromValueAllValues() {
        assertEquals(EventType.PROCESS_START, EventType.fromValue("PROCESS_START"));
        assertEquals(EventType.STEP, EventType.fromValue("STEP"));
        assertEquals(EventType.PROCESS_END, EventType.fromValue("PROCESS_END"));
        assertEquals(EventType.ERROR, EventType.fromValue("ERROR"));
    }

    @Test
    void eventTypeFromValueCaseInsensitive() {
        assertEquals(EventType.STEP, EventType.fromValue("step"));
        assertEquals(EventType.ERROR, EventType.fromValue("Error"));
    }

    @Test
    void eventTypeFromValueThrowsOnUnknown() {
        assertThrows(IllegalArgumentException.class, () -> EventType.fromValue("UNKNOWN"));
    }

    @Test
    void eventTypeGetValue() {
        assertEquals("PROCESS_START", EventType.PROCESS_START.getValue());
        assertEquals("STEP", EventType.STEP.getValue());
        assertEquals("PROCESS_END", EventType.PROCESS_END.getValue());
        assertEquals("ERROR", EventType.ERROR.getValue());
    }

    @Test
    void httpMethodFromValueAllValues() {
        assertEquals(HttpMethod.GET, HttpMethod.fromValue("GET"));
        assertEquals(HttpMethod.POST, HttpMethod.fromValue("POST"));
        assertEquals(HttpMethod.PUT, HttpMethod.fromValue("PUT"));
        assertEquals(HttpMethod.DELETE, HttpMethod.fromValue("DELETE"));
        assertEquals(HttpMethod.PATCH, HttpMethod.fromValue("PATCH"));
        assertEquals(HttpMethod.HEAD, HttpMethod.fromValue("HEAD"));
        assertEquals(HttpMethod.OPTIONS, HttpMethod.fromValue("OPTIONS"));
    }

    @Test
    void httpMethodFromValueCaseInsensitive() {
        assertEquals(HttpMethod.GET, HttpMethod.fromValue("get"));
        assertEquals(HttpMethod.POST, HttpMethod.fromValue("Post"));
    }

    @Test
    void httpMethodFromValueThrowsOnUnknown() {
        assertThrows(IllegalArgumentException.class, () -> HttpMethod.fromValue("UNKNOWN"));
    }

    @Test
    void httpMethodGetValue() {
        assertEquals("GET", HttpMethod.GET.getValue());
        assertEquals("POST", HttpMethod.POST.getValue());
        assertEquals("PUT", HttpMethod.PUT.getValue());
        assertEquals("DELETE", HttpMethod.DELETE.getValue());
        assertEquals("PATCH", HttpMethod.PATCH.getValue());
        assertEquals("HEAD", HttpMethod.HEAD.getValue());
        assertEquals("OPTIONS", HttpMethod.OPTIONS.getValue());
    }
}
