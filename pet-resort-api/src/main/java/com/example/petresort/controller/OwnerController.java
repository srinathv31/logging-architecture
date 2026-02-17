package com.example.petresort.controller;

import com.example.petresort.model.Booking;
import com.example.petresort.model.BookingResponse;
import com.example.petresort.model.Owner;
import com.example.petresort.service.OwnerService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/owners")
public class OwnerController {

    private final OwnerService ownerService;

    public OwnerController(OwnerService ownerService) {
        this.ownerService = ownerService;
    }

    @GetMapping("/{id}")
    public Owner getOwner(@PathVariable String id) {
        return ownerService.getOwner(id);
    }

    @GetMapping("/{id}/bookings")
    public List<BookingResponse> getOwnerBookings(@PathVariable String id) {
        return ownerService.getOwnerBookings(id).stream()
                .map(BookingResponse::from)
                .toList();
    }
}
