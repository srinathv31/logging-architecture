package com.eventlog.sdk.model;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * HTTP method enumeration for API call logging
 */
public enum HttpMethod {
    GET("GET"),
    POST("POST"),
    PUT("PUT"),
    DELETE("DELETE"),
    PATCH("PATCH"),
    HEAD("HEAD"),
    OPTIONS("OPTIONS");

    private final String value;

    HttpMethod(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static HttpMethod fromValue(String value) {
        for (HttpMethod method : HttpMethod.values()) {
            if (method.value.equalsIgnoreCase(value)) {
                return method;
            }
        }
        throw new IllegalArgumentException("Unknown HttpMethod: " + value);
    }
}
