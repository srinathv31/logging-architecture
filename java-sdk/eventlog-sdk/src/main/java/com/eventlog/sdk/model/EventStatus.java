package com.eventlog.sdk.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Event status enumeration following the Event Log API schema v1
 */
public enum EventStatus {
    SUCCESS("SUCCESS"),
    FAILURE("FAILURE"),
    IN_PROGRESS("IN_PROGRESS"),
    SKIPPED("SKIPPED");

    private final String value;

    EventStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static EventStatus fromValue(String value) {
        for (EventStatus status : EventStatus.values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown EventStatus: " + value);
    }
}
