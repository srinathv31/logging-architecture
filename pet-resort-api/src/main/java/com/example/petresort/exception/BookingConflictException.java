package com.example.petresort.exception;

public class BookingConflictException extends RuntimeException {

    private final String bookingId;
    private final String errorCode;

    public BookingConflictException(String bookingId, String errorCode, String message) {
        super(message);
        this.bookingId = bookingId;
        this.errorCode = errorCode;
    }

    public String getBookingId() { return bookingId; }
    public String getErrorCode() { return errorCode; }
}
