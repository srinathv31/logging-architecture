package com.eventlog.sdk.exception;

/**
 * Base exception for Event Log SDK errors
 */
public class EventLogException extends RuntimeException {
    
    private final int statusCode;
    private final String errorCode;

    public EventLogException(String message) {
        super(message);
        this.statusCode = 0;
        this.errorCode = null;
    }

    public EventLogException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = 0;
        this.errorCode = null;
    }

    public EventLogException(String message, int statusCode, String errorCode) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }

    public EventLogException(String message, int statusCode, String errorCode, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
