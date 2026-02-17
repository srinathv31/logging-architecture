package com.example.petresort.store;

import com.example.petresort.model.Pet;
import com.example.petresort.model.PetSpecies;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InMemoryPetStore {

    private final ConcurrentHashMap<String, Pet> pets = new ConcurrentHashMap<>();

    @PostConstruct
    void seed() {
        save(new Pet("PET-001", "Buddy", PetSpecies.DOG, "Golden Retriever", 3, "OWN-001",
                "Needs daily medication for allergies"));
        save(new Pet("PET-002", "Whiskers", PetSpecies.CAT, "Siamese", 5, "OWN-001",
                "Indoor only, shy around other cats"));
        save(new Pet("PET-003", "Tweety", PetSpecies.BIRD, "Cockatiel", 2, "OWN-002",
                "Requires covered cage at night"));
        save(new Pet("PET-004", "Thumper", PetSpecies.RABBIT, "Holland Lop", 1, "OWN-002", null));
        save(new Pet("PET-005", "Scales", PetSpecies.REPTILE, "Bearded Dragon", 4, "OWN-003",
                "Heat lamp required, feed crickets daily"));
    }

    public void save(Pet pet) {
        pets.put(pet.petId(), pet);
    }

    public Optional<Pet> findById(String petId) {
        return Optional.ofNullable(pets.get(petId));
    }

    public Collection<Pet> findAll() {
        return pets.values();
    }
}
