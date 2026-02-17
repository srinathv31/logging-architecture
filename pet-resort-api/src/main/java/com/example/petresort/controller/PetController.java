package com.example.petresort.controller;

import com.example.petresort.model.Pet;
import com.example.petresort.service.PetService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pets")
public class PetController {

    private final PetService petService;

    public PetController(PetService petService) {
        this.petService = petService;
    }

    @GetMapping("/{id}")
    public Pet getPet(@PathVariable String id) {
        return petService.getPet(id);
    }
}
