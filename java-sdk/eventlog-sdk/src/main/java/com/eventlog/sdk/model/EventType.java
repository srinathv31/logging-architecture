package com.eventlog.sdk.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Event type enumeration following the Event Log API schema v1
 */
public enum EventType {
    PROCESS_START("PROCESS_START"),
    STEP("STEP"),
    PROCESS_END("PROCESS_END"),
    ERROR("ERROR");

    private final String value;

    EventType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static EventType fromValue(String value) {
        for (EventType type : EventType.values()) {
            if (type.value.equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown EventType: " + value);
    }
}
