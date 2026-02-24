package com.example.petresort.config;

import com.example.petresort.model.BookingStatus;
import com.example.petresort.store.InMemoryBookingStore;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PetResortMetricsConfig {

    public PetResortMetricsConfig(InMemoryBookingStore bookingStore, MeterRegistry registry) {
        Gauge.builder("petresort.bookings.active", bookingStore, store ->
                store.findAll().stream()
                        .filter(b -> b.getStatus() == BookingStatus.PENDING
                                || b.getStatus() == BookingStatus.AWAITING_APPROVAL
                                || b.getStatus() == BookingStatus.CHECKED_IN)
                        .count())
                .description("Active bookings (PENDING + AWAITING_APPROVAL + CHECKED_IN)")
                .register(registry);

        Gauge.builder("petresort.pets.checked_in", bookingStore, store ->
                store.findAll().stream()
                        .filter(b -> b.getStatus() == BookingStatus.CHECKED_IN)
                        .count())
                .description("Pets currently checked in")
                .register(registry);
    }
}
