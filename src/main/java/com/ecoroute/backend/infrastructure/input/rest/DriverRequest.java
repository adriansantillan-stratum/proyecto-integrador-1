package com.ecoroute.backend.infrastructure.input.rest;

import jakarta.validation.constraints.*;

public record DriverRequest(
    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 50)
    String firstName,

    @NotBlank(message = "El apellido es obligatorio")
    @Size(max = 50)
    String lastName,

    @NotBlank(message = "La licencia es obligatoria")
    @Pattern(regexp = "^[A-Z][0-9]{8}$", message = "Formato de licencia inválido (Ej: Q12345678)")
    String licenseNumber,

    @NotBlank(message = "El teléfono es obligatorio")
    @Pattern(regexp = "^9[0-9]{8}$", message = "El teléfono debe empezar con 9 y tener 9 dígitos")
    String phoneNumber,

    @Email(message = "Formato de email inválido")
    String email,

    Boolean isActive
) {}
