package com.ecoroute.backend.infrastructure.input.rest;

import java.math.BigDecimal;
import jakarta.validation.constraints.*;

public record PurchaseRequest(
    @NotBlank @Size(max=255) String description,
    @NotBlank @Size(max=255) String supplier,
    @NotNull @DecimalMin(value="0.00",inclusive=false) @Digits(integer=10,fraction=2) BigDecimal amount,
    @Pattern(regexp="PENDING|APPROVED|REJECTED|COMPLETED") String status,
    @Size(max=100) String category,
    @Size(max=4000) String notes
) {}
