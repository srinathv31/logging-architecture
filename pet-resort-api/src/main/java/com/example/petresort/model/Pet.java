package com.example.petresort.model;

public record Pet(
        String petId,
        String name,
        PetSpecies species,
        String breed,
        int ageYears,
        String ownerId,
        String specialInstructions) {
}
