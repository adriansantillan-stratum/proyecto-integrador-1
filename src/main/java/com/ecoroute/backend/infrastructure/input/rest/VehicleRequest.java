package com.ecoroute.backend.infrastructure.input.rest;

import jakarta.validation.constraints.*;

public record VehicleRequest(
    @NotBlank(message = "La placa es obligatoria")
    @Pattern(regexp = "^[A-Z0-9]{3}-[A-Z0-9]{3}$", message = "Formato de placa inválido (Ej: ABC-123)")
    String plateNumber,

    @NotBlank(message = "El modelo es obligatorio")
    @Size(max = 50)
    String model,

    @NotBlank(message = "La marca es obligatoria")
    @Size(max = 50)
    String brand,

    @Positive(message = "La capacidad debe ser positiva")
    Double capacityKg,

    @Positive(message = "La capacidad debe ser positiva")
    Double capacityM3,

    Boolean isActive
) {}
