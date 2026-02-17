package com.example.petresort.exception;

public class PaymentFailedException extends RuntimeException {

    private final String bookingId;

    public PaymentFailedException(String bookingId, String message) {
        super(message);
        this.bookingId = bookingId;
    }

    public String getBookingId() { return bookingId; }
}
