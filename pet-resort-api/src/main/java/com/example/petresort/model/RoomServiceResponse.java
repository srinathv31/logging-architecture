package com.example.petresort.model;

public record RoomServiceResponse(
        String orderId,
        String petId,
        String bookingId,
        String kennelNumber,
        String item,
        int quantity,
        String status) {
}
