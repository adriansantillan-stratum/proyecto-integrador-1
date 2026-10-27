package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.ports.in.CreateOrderUseCase;
import com.ecoroute.backend.domain.ports.in.GetAllOrdersUseCase;
import com.ecoroute.backend.domain.ports.in.GetOrderByIdUseCase;
import com.ecoroute.backend.domain.ports.in.UpdateOrderStatusUseCase;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import com.ecoroute.backend.domain.ports.in.AssignOrderUseCase;
import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {

    private final CreateOrderUseCase createOrderUseCase;
    private final GetOrderByIdUseCase getOrderByIdUseCase;
    private final GetAllOrdersUseCase getAllOrdersUseCase;
    private final UpdateOrderStatusUseCase updateOrderStatusUseCase;
    private final OrderRepository orderRepository;
    private final AssignOrderUseCase assignOrderUseCase;
    private final OperationalAccess access;
    private final com.ecoroute.backend.domain.ports.in.ChangeDeliveryWindowUseCase changeWindow;
    private final OrderCsvParser csvParser;
    private final com.ecoroute.backend.application.services.OrderImportService importer;

    @PostMapping
    public Mono<Order> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        Order order = OrderRestMapper.toDomain(request);
        return createOrderUseCase.createOrder(order);
    }

    @GetMapping("/{id}")
    public Mono<Order> getOrderById(@PathVariable Long id) {
        return access.requireOrder(id);
    }

    @GetMapping
    public Flux<Order> getAllOrders(
            @RequestParam(required = false) Long routeId) {
        if (routeId != null) {
            return access.requireRoute(routeId).thenMany(orderRepository.findByRouteId(routeId));
        }
        return getAllOrdersUseCase.getAllOrders().filterWhen(access::mayReadOrder);
    }

    @DeleteMapping("/{id}")
    public Mono<Void> deleteOrder(@PathVariable Long id) {
        return orderRepository.deleteById(id);
    }

    @PatchMapping("/{id}/status")
    public Mono<Order> updateStatus(@PathVariable Long id, @RequestBody UpdateStatusRequest request) {
        return access.requireOrder(id).then(updateOrderStatusUseCase.updateStatusManual(id, request.status(), request.reason()));
    }

    @PatchMapping("/{id}/route")
    public Mono<Order> assign(@PathVariable Long id, @Valid @RequestBody AssignmentRequest request) {
        return assignOrderUseCase.assignOrder(id,request.routeId());
    }
    public record AssignmentRequest(@jakarta.validation.constraints.NotNull Long routeId) {}
    @PatchMapping("/{id}/delivery-window")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN','DISPATCHER')")
    public Mono<Order> changeDeliveryWindow(@PathVariable Long id,@RequestBody WindowRequest request) {
        return access.authentication().flatMap(actor -> changeWindow.changeDeliveryWindow(id,request.estimatedDeliveryWindowStart(),
            request.estimatedDeliveryWindowEnd(),request.reason(),actor.getName()));
    }
    public record WindowRequest(java.time.OffsetDateTime estimatedDeliveryWindowStart,
            java.time.OffsetDateTime estimatedDeliveryWindowEnd,String reason) {}

    @PostMapping("/bulk-csv")
    public Flux<Order> bulkImportCsv(@RequestBody String csvContent) {
        return importer.importOrders(csvParser.parse(csvContent)).collectList().flatMapMany(Flux::fromIterable);
    }
    @PostMapping("/bulk-csv/preview")
    public java.util.List<Order> previewCsv(@RequestBody String csvContent) {
        // Same parser and validation as import; no repository writes.
        return csvParser.parse(csvContent);
    }

}
