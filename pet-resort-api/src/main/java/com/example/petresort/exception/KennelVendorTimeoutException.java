package com.example.petresort.exception;

public class KennelVendorTimeoutException extends RuntimeException {

    private final String petId;

    public KennelVendorTimeoutException(String petId, String message) {
        super(message);
        this.petId = petId;
    }

    public String getPetId() { return petId; }
}
