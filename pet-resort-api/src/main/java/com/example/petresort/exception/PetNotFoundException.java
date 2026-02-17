package com.example.petresort.exception;

public class PetNotFoundException extends RuntimeException {

    private final String petId;

    public PetNotFoundException(String petId) {
        super("Pet not found: " + petId);
        this.petId = petId;
    }

    public String getPetId() { return petId; }
}
