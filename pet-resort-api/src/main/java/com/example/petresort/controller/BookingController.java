package com.example.petresort.controller;

import com.example.petresort.model.*;
import com.example.petresort.service.BookingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookingResponse createBooking(@Valid @RequestBody CreateBookingRequest request) {
        Booking booking = bookingService.createBooking(request);
        return BookingResponse.from(booking);
    }

    @GetMapping("/{id}")
    public BookingResponse getBooking(@PathVariable String id) {
        Booking booking = bookingService.getBooking(id);
        return BookingResponse.from(booking);
    }

    @GetMapping
    public List<BookingResponse> listBookings() {
        return bookingService.listBookings().stream()
                .map(BookingResponse::from)
                .toList();
    }

    @PostMapping("/{id}/check-in")
    public BookingResponse checkIn(@PathVariable String id,
                                   @RequestBody(required = false) CheckInRequest request) {
        Booking booking = bookingService.checkIn(id, request);
        return BookingResponse.from(booking);
    }

    @PostMapping("/{id}/check-out")
    public BookingResponse checkOut(@PathVariable String id,
                                    @Valid @RequestBody CheckOutRequest request) {
        Booking booking = bookingService.checkOut(id, request);
        return BookingResponse.from(booking);
    }

    @DeleteMapping("/{id}")
    public BookingResponse cancelBooking(@PathVariable String id) {
        Booking booking = bookingService.cancelBooking(id);
        return BookingResponse.from(booking);
    }
}
