package com.example.petresort.service;

import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.model.EventType;
import com.eventlog.sdk.util.EventLogUtils;
import com.example.petresort.exception.OwnerNotFoundException;
import com.example.petresort.model.Booking;
import com.example.petresort.model.Owner;
import com.example.petresort.store.InMemoryBookingStore;
import com.example.petresort.store.InMemoryOwnerStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OwnerService {

    private static final Logger log = LoggerFactory.getLogger(OwnerService.class);

    private final InMemoryOwnerStore ownerStore;
    private final InMemoryBookingStore bookingStore;

    public OwnerService(InMemoryOwnerStore ownerStore, InMemoryBookingStore bookingStore) {
        this.ownerStore = ownerStore;
        this.bookingStore = bookingStore;
    }

    @LogEvent(process = "OWNER_LOOKUP", step = 1, name = "Retrieve Owner",
              eventType = EventType.STEP,
              summary = "Owner details retrieved", result = "OWNER_FOUND",
              failureSummary = "Owner not found", failureResult = "NOT_FOUND",
              errorCode = "OWNER_NOT_FOUND")
    public Owner getOwner(String ownerId) {
        Owner owner = ownerStore.findById(ownerId)
                .orElseThrow(() -> new OwnerNotFoundException(ownerId));

        // Demonstrate maskLast4 — phone number masked in application logs
        log.debug("Retrieved owner {} with phone {}", ownerId,
                EventLogUtils.maskLast4(owner.phone()));

        return owner;
    }

    public List<Booking> getOwnerBookings(String ownerId) {
        // Verify owner exists first
        ownerStore.findById(ownerId)
                .orElseThrow(() -> new OwnerNotFoundException(ownerId));

        return bookingStore.findByOwnerId(ownerId);
    }
}
