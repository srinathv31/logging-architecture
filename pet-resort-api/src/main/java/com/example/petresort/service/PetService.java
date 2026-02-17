package com.example.petresort.service;

import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.model.EventType;
import com.example.petresort.exception.PetNotFoundException;
import com.example.petresort.model.Pet;
import com.example.petresort.store.InMemoryPetStore;
import org.springframework.stereotype.Service;

@Service
public class PetService {

    private final InMemoryPetStore petStore;

    public PetService(InMemoryPetStore petStore) {
        this.petStore = petStore;
    }

    @LogEvent(process = "PET_LOOKUP", step = 1, name = "Retrieve Pet",
              eventType = EventType.STEP,
              summary = "Pet details retrieved", result = "PET_FOUND",
              failureSummary = "Pet not found", failureResult = "NOT_FOUND",
              errorCode = "PET_NOT_FOUND")
    public Pet getPet(String petId) {
        return petStore.findById(petId)
                .orElseThrow(() -> new PetNotFoundException(petId));
    }
}
