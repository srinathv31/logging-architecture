package com.example.petresort.service;

import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.model.EventType;
import com.example.petresort.model.PetSpecies;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class KennelService {

    private static final Map<PetSpecies, String> ZONE_MAP = Map.of(
            PetSpecies.DOG, "A",
            PetSpecies.CAT, "B",
            PetSpecies.BIRD, "C",
            PetSpecies.RABBIT, "C",
            PetSpecies.REPTILE, "D"
    );

    public record KennelAssignment(String kennelNumber, String zone) {}

    @LogEvent(process = "CHECK_IN_PET", step = 2, name = "Assign Kennel",
              eventType = EventType.STEP,
              summary = "Kennel assigned for pet stay",
              result = "KENNEL_ASSIGNED",
              failureSummary = "Kennel assignment failed",
              failureResult = "ASSIGNMENT_FAILED")
    public KennelAssignment assignKennel(PetSpecies species, String preference) {
        String zone = ZONE_MAP.getOrDefault(species, "A");
        int number = ThreadLocalRandom.current().nextInt(1, 20);

        if (preference != null && !preference.isBlank()) {
            // Honour preference zone if it matches species zone
            zone = preference.substring(0, 1).toUpperCase();
        }

        String kennelNumber = zone + "-" + String.format("%02d", number);
        return new KennelAssignment(kennelNumber, zone);
    }
}
