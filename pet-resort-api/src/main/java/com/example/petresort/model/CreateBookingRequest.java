package com.example.petresort.model;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreateBookingRequest(
        @NotBlank String petId,
        @NotNull @Future LocalDate checkInDate,
        @NotNull @Future LocalDate checkOutDate) {
}
