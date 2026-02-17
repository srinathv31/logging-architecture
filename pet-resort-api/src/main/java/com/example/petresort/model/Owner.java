package com.example.petresort.model;

public record Owner(
        String ownerId,
        String name,
        String email,
        String phone) {
}
