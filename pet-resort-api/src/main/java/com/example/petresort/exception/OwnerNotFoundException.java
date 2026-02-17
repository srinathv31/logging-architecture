package com.example.petresort.exception;

public class OwnerNotFoundException extends RuntimeException {

    private final String ownerId;

    public OwnerNotFoundException(String ownerId) {
        super("Owner not found: " + ownerId);
        this.ownerId = ownerId;
    }

    public String getOwnerId() { return ownerId; }
}
