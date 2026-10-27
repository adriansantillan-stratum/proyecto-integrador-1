package com.ecoroute.backend.domain.model;

import com.ecoroute.backend.domain.exception.BusinessRuleException;
import java.util.Set;

/** Server-side lifecycle shared by manual updates, dispatch and POD. */
public final class OrderLifecycle {
    private OrderLifecycle() {}
    public static boolean terminal(OrderStatus state) {
        return Set.of(OrderStatus.DELIVERED, OrderStatus.FAILED, OrderStatus.RETURNED).contains(state);
    }
    public static void validateManual(OrderStatus from, OrderStatus to, String reason) {
        if (to == null) throw new IllegalArgumentException("Debe indicar el estado del pedido");
        if (to == OrderStatus.DELIVERED)
            throw new BusinessRuleException("Confirme la entrega mediante una prueba con foto, firma, receptor y GPS");
        if (from == to) return;
        if (terminal(from)) throw new BusinessRuleException("Un pedido cerrado no puede reabrirse; registre un nuevo intento autorizado");
        boolean allowed = switch (from) {
            case ASSIGNED -> to == OrderStatus.PICKED_UP;
            case PICKED_UP -> to == OrderStatus.IN_TRANSIT || to == OrderStatus.FAILED;
            case IN_TRANSIT -> to == OrderStatus.FAILED || to == OrderStatus.RETURNED;
            default -> false;
        };
        if (!allowed) throw new BusinessRuleException("Transición no permitida: " + from + " a " + to);
        if ((to == OrderStatus.FAILED || to == OrderStatus.RETURNED) && (reason == null || reason.trim().length() < 5))
            throw new IllegalArgumentException("Indique un motivo de no entrega de al menos cinco caracteres");
    }
}
