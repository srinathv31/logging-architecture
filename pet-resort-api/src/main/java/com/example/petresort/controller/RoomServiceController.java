package com.example.petresort.controller;

import com.example.petresort.model.RoomServiceRequest;
import com.example.petresort.model.RoomServiceResponse;
import com.example.petresort.service.RoomServiceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/room-service")
public class RoomServiceController {

    private final RoomServiceService roomServiceService;

    public RoomServiceController(RoomServiceService roomServiceService) {
        this.roomServiceService = roomServiceService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomServiceResponse orderRoomService(@Valid @RequestBody RoomServiceRequest request) {
        return roomServiceService.fulfillRoomService(request);
    }
}
