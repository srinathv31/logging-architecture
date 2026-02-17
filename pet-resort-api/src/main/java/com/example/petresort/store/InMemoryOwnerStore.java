package com.example.petresort.store;

import com.example.petresort.model.Owner;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InMemoryOwnerStore {

    private final ConcurrentHashMap<String, Owner> owners = new ConcurrentHashMap<>();

    @PostConstruct
    void seed() {
        save(new Owner("OWN-001", "Alice Johnson", "alice@example.com", "555-0101"));
        save(new Owner("OWN-002", "Bob Martinez", "bob@example.com", "555-0202"));
        save(new Owner("OWN-003", "Carol Chen", "carol@example.com", "555-0303"));
    }

    public void save(Owner owner) {
        owners.put(owner.ownerId(), owner);
    }

    public Optional<Owner> findById(String ownerId) {
        return Optional.ofNullable(owners.get(ownerId));
    }

    public Collection<Owner> findAll() {
        return owners.values();
    }
}
