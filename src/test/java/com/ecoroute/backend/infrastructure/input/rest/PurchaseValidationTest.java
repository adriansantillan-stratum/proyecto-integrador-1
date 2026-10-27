package com.ecoroute.backend.infrastructure.input.rest;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
class PurchaseValidationTest {
    @Test void rejectEmptySupplierDescriptionAndNonPositiveAmount() {
        try(var factory=Validation.buildDefaultValidatorFactory()) {
            var v=factory.getValidator();
            assertFalse(v.validate(new PurchaseRequest("", "", BigDecimal.ZERO,"PENDING",null,null)).isEmpty());
            assertFalse(v.validate(new PurchaseRequest("Combustible", "Proveedor", new BigDecimal("-1"),"PENDING",null,null)).isEmpty());
        }
    }
    @Test void validPurchaseHasPositiveMoneyAndKnownStatus() {
        try(var factory=Validation.buildDefaultValidatorFactory()) {
            var v=factory.getValidator();
            assertTrue(v.validate(new PurchaseRequest("Combustible", "Proveedor", new BigDecimal("120.50"),"PENDING","Operación",null)).isEmpty());
            assertFalse(v.validate(new PurchaseRequest("Combustible", "Proveedor", new BigDecimal("120.501"),"UNKNOWN",null,null)).isEmpty());
        }
    }
}
