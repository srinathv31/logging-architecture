package com.example.petresort.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record RoomServiceRequest(
        @NotBlank String petId,
        @NotBlank String bookingId,
        @NotBlank String item,
        @Positive int quantity) {
}
