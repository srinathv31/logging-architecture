package com.example.petresort.exception;

public class BookingNotFoundException extends RuntimeException {

    private final String bookingId;

    public BookingNotFoundException(String bookingId) {
        super("Booking not found: " + bookingId);
        this.bookingId = bookingId;
    }

    public String getBookingId() { return bookingId; }
}
