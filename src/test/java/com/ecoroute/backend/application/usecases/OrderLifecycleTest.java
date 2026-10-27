package com.ecoroute.backend.application.usecases;
import com.ecoroute.backend.domain.model.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class OrderLifecycleTest {
    @Test void allClosedOutcomesAreTerminal() {
        assertTrue(OrderLifecycle.terminal(OrderStatus.DELIVERED));
        assertTrue(OrderLifecycle.terminal(OrderStatus.FAILED));
        assertTrue(OrderLifecycle.terminal(OrderStatus.RETURNED));
        assertFalse(OrderLifecycle.terminal(OrderStatus.IN_TRANSIT));
    }
    @Test void failureRequiresReason() {
        assertThrows(IllegalArgumentException.class,() -> OrderLifecycle.validateManual(OrderStatus.IN_TRANSIT,OrderStatus.FAILED,""));
        assertDoesNotThrow(() -> OrderLifecycle.validateManual(OrderStatus.IN_TRANSIT,OrderStatus.FAILED,"Cliente ausente"));
    }
    @Test void noPendingCanBeMarkedInTransitDirectly() {
        assertThrows(RuntimeException.class,() -> OrderLifecycle.validateManual(OrderStatus.PENDING,OrderStatus.IN_TRANSIT,"adelantar"));
    }
}
