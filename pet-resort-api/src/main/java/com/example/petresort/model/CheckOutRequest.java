package com.example.petresort.model;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record CheckOutRequest(
        @NotNull @Positive BigDecimal paymentAmount,
        String cardNumberLast4) {
}
