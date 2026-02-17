package com.example.petresort.store;

import com.example.petresort.model.Booking;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class InMemoryBookingStore {

    private final ConcurrentHashMap<String, Booking> bookings = new ConcurrentHashMap<>();
    private final AtomicInteger idSequence = new AtomicInteger(1);

    @PostConstruct
    void seed() {
        Booking booking = new Booking(
                "BKG-001", "PET-001", "OWN-001",
                LocalDate.now().plusDays(1), LocalDate.now().plusDays(5));
        bookings.put(booking.getBookingId(), booking);
        idSequence.set(2);
    }

    public String nextId() {
        return "BKG-%03d".formatted(idSequence.getAndIncrement());
    }

    public void save(Booking booking) {
        bookings.put(booking.getBookingId(), booking);
    }

    public Optional<Booking> findById(String bookingId) {
        return Optional.ofNullable(bookings.get(bookingId));
    }

    public Collection<Booking> findAll() {
        return bookings.values();
    }

    public List<Booking> findByOwnerId(String ownerId) {
        return bookings.values().stream()
                .filter(b -> b.getOwnerId().equals(ownerId))
                .toList();
    }
}
