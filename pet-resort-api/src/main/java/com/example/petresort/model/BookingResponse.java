package com.example.petresort.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record BookingResponse(
        String bookingId,
        String petId,
        String ownerId,
        BookingStatus status,
        LocalDate checkInDate,
        LocalDate checkOutDate,
        String kennelNumber,
        BigDecimal totalAmount,
        Instant createdAt,
        Instant checkedInAt,
        Instant checkedOutAt) {

    public static BookingResponse from(Booking booking) {
        return new BookingResponse(
                booking.getBookingId(),
                booking.getPetId(),
                booking.getOwnerId(),
                booking.getStatus(),
                booking.getCheckInDate(),
                booking.getCheckOutDate(),
                booking.getKennelNumber(),
                booking.getTotalAmount(),
                booking.getCreatedAt(),
                booking.getCheckedInAt(),
                booking.getCheckedOutAt());
    }
}
