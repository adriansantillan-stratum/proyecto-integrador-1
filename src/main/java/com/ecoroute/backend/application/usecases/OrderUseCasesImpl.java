package com.ecoroute.backend.application.usecases;

import com.ecoroute.backend.domain.exception.ResourceNotFoundException;
import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.model.OrderStatus;
import com.ecoroute.backend.domain.model.OrderLifecycle;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.ports.in.AssignOrderUseCase;
import com.ecoroute.backend.domain.ports.out.OrderAuditPort;
import com.ecoroute.backend.domain.ports.out.RouteRepository;
import com.ecoroute.backend.domain.ports.out.BusinessWorkflowPort;
import com.ecoroute.backend.domain.model.RouteStatus;
import com.ecoroute.backend.domain.ports.in.CreateOrderUseCase;
import com.ecoroute.backend.domain.ports.in.GetAllOrdersUseCase;
import com.ecoroute.backend.domain.ports.in.GetOrderByIdUseCase;
import com.ecoroute.backend.domain.ports.in.UpdateOrderStatusUseCase;
import com.ecoroute.backend.domain.ports.in.UpdateRouteStatusUseCase;
import com.ecoroute.backend.domain.ports.out.OrderRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;

@Service
public class OrderUseCasesImpl implements CreateOrderUseCase, GetOrderByIdUseCase, GetAllOrdersUseCase, UpdateOrderStatusUseCase, AssignOrderUseCase,
        com.ecoroute.backend.domain.ports.in.ChangeDeliveryWindowUseCase {

    private final OrderRepository orderRepository;
    private final UpdateRouteStatusUseCase routeService;
    private final RouteRepository routeRepository;
    private final OrderAuditPort audit;
    private final BusinessWorkflowPort workflow;
    private final com.ecoroute.backend.domain.ports.out.BusinessOperationsPort operations;

    public OrderUseCasesImpl(OrderRepository orderRepository, @Lazy UpdateRouteStatusUseCase routeService,
                             RouteRepository routeRepository, OrderAuditPort audit,BusinessWorkflowPort workflow,
                             com.ecoroute.backend.domain.ports.out.BusinessOperationsPort operations) {
        this.orderRepository = orderRepository;
        this.routeService = routeService;
        this.routeRepository = routeRepository;
        this.audit = audit;
        this.workflow = workflow;
        this.operations = operations;
    }

    @Override
    @Transactional
    public Mono<Order> createOrder(Order order) {
        if(order.routeId()!=null) return Mono.error(new BusinessRuleException("Registre y confirme primero el pedido; asigne la ruta en planificación"));
        OrderStatus initialStatus = (order.routeId() != null) ? OrderStatus.ASSIGNED : OrderStatus.PENDING;
        Order orderToSave = new Order(
                null, order.trackingNumber(), order.externalReference(),
                order.routeId(), initialStatus, order.recipientName(),
                order.recipientPhone(), order.recipientEmail(),
                order.deliveryAddress(), order.deliveryCity(),
                order.deliveryDistrict(), order.latitude(), order.longitude(),
                order.priority(), order.estimatedDeliveryWindowStart(),
                order.estimatedDeliveryWindowEnd(), OffsetDateTime.now(),
                OffsetDateTime.now()
        );
        Mono<Void> validRoute = order.routeId() == null ? Mono.empty() : routeRepository.lockById(order.routeId())
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Ruta no encontrada")))
                .flatMap(route -> route.status() == RouteStatus.PLANNED ? Mono.empty()
                        : Mono.error(new BusinessRuleException("Solo se asignan pedidos a rutas planificadas")));
        return validRoute.then(orderRepository.save(orderToSave))
                .flatMap(saved -> audit.record(saved,"Solicitud registrada pendiente de validación comercial").thenReturn(saved));
    }

    @Override
    @Transactional
    public Mono<Order> assignOrder(Long orderId, Long routeId) {
        if (routeId == null) return Mono.error(new IllegalArgumentException("Seleccione una ruta"));
        return routeRepository.lockById(routeId)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Ruta no encontrada")))
                .flatMap(route -> {
                    if (route.status() != RouteStatus.PLANNED)
                        return Mono.error(new BusinessRuleException("La ruta debe estar planificada para asignar pedidos"));
                    return orderRepository.lockById(orderId)
                            .switchIfEmpty(Mono.error(new ResourceNotFoundException("Pedido no encontrado")))
                            .flatMap(order -> {
                                if (order.status() != OrderStatus.PENDING && order.status() != OrderStatus.ASSIGNED)
                                    return Mono.error(new BusinessRuleException("No se reasigna un pedido ya despachado o cerrado"));
                                Mono<Void> sourceCheck = order.routeId() == null || order.routeId().equals(routeId)
                                        ? Mono.empty() : routeRepository.findById(order.routeId()).flatMap(source ->
                                        source.status() == RouteStatus.PLANNED ? Mono.empty()
                                                : Mono.error(new BusinessRuleException("La ruta anterior ya fue despachada")));
                                return sourceCheck.then(workflow.requireConfirmed(orderId))
                                        .then(workflow.invalidate(order.routeId())).then(workflow.invalidate(routeId))
                                        .then(Mono.defer(() -> orderRepository.save(order.withAssignment(routeId,OrderStatus.ASSIGNED))))
                                        .flatMap(saved -> audit.record(saved,"Asignación a ruta " + routeId).thenReturn(saved));
                            });
                });
    }

    @Override
    public Mono<Order> getOrderById(Long id) {
        return orderRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Order not found with id: " + id)));
    }
    @Override
    @Transactional
    public Mono<Order> changeDeliveryWindow(Long id,OffsetDateTime start,OffsetDateTime end,String reason,String actor) {
        if(start==null || end==null || !end.isAfter(start) || !end.isAfter(OffsetDateTime.now()) || reason==null || reason.trim().length()<5)
            return Mono.error(new IllegalArgumentException("Indique una ventana vigente y ordenada, con motivo de al menos cinco caracteres"));
        return orderRepository.lockById(id).switchIfEmpty(Mono.error(new ResourceNotFoundException("Pedido no encontrado")))
            .flatMap(order -> {
                if(order.status()!=OrderStatus.PENDING && order.status()!=OrderStatus.ASSIGNED)
                    return Mono.error(new BusinessRuleException("Solo se cambia la promesa antes del despacho"));
                Mono<Void> routeCheck=order.routeId()==null?Mono.empty():routeRepository.findById(order.routeId())
                    .switchIfEmpty(Mono.error(new ResourceNotFoundException("Ruta no encontrada")))
                    .flatMap(route -> route.status()==RouteStatus.PLANNED?Mono.empty():Mono.error(new BusinessRuleException("La ruta ya fue despachada")));
                Order updated=new Order(order.id(),order.trackingNumber(),order.externalReference(),order.routeId(),order.status(),
                    order.recipientName(),order.recipientPhone(),order.recipientEmail(),order.deliveryAddress(),order.deliveryCity(),
                    order.deliveryDistrict(),order.latitude(),order.longitude(),order.priority(),start,end,order.createdAt(),OffsetDateTime.now());
                return routeCheck.then(orderRepository.save(updated)).flatMap(saved -> workflow.confirmation(id)
                    .flatMap(c -> workflow.saveConfirmation(new com.ecoroute.backend.domain.model.BusinessWorkflow.Confirmation(id,c.recipientRuc(),
                        false,c.addressVerified(),c.coverageVerified(),"Nueva ventana pendiente de aceptación: "+reason,actor,null)))
                    .then(workflow.invalidate(order.routeId()))
                    .then(workflow.audit("P01","ORDER",id,"DELIVERY_WINDOW_CHANGED",actor,reason+"; start="+start+"; end="+end))
                    .then(audit.record(saved,"Nueva ventana de entrega: "+reason)).thenReturn(saved));
            });
    }

    @Override
    public Flux<Order> getAllOrders() {
        return orderRepository.findAll();
    }

    @Override
    @Transactional
    public Mono<Order> updateStatusManual(Long id, OrderStatus status, String reason) {
        return orderRepository.lockById(id)
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Order not found")))
                .flatMap(order -> {
                    OrderLifecycle.validateManual(order.status(),status,reason);
                    if(order.status()==status) return Mono.just(order);
                    // Create the updated order with the EXACT status requested from UI
                    Order updatedOrder = new Order(
                            order.id(), order.trackingNumber(), order.externalReference(),
                            order.routeId(), status, order.recipientName(),
                            order.recipientPhone(), order.recipientEmail(),
                            order.deliveryAddress(), order.deliveryCity(),
                            order.deliveryDistrict(), order.latitude(), order.longitude(),
                            order.priority(), order.estimatedDeliveryWindowStart(),
                            order.estimatedDeliveryWindowEnd(), order.createdAt(),
                            OffsetDateTime.now()
                    );
                    
                    return orderRepository.save(updatedOrder)
                            .flatMap(savedOrder -> {
                                Mono<Void> history = audit.record(savedOrder,reason);
                                if((status==OrderStatus.FAILED || status==OrderStatus.RETURNED) && savedOrder.routeId()!=null) {
                                    history=history.then(reactor.core.publisher.Mono.defer(() ->
                                        org.springframework.security.core.context.ReactiveSecurityContextHolder.getContext()
                                            .map(context -> context.getAuthentication().getName()).defaultIfEmpty("SYSTEM")
                                            .flatMap(actor -> operations.createIncident(new com.ecoroute.backend.domain.model.BusinessOperations.Incident(
                                                null,savedOrder.routeId(),savedOrder.id(),"DELIVERY_FAILED","MEDIUM",reason,
                                                "OPEN",null,null,null,null,actor,null,null,null)))).then());
                                }
                                if (savedOrder.routeId() != null) {
                                    // Check if this was the last order to finish the route
                                    return history.then(checkAndCompleteRoute(savedOrder.routeId())).thenReturn(savedOrder);
                                }
                                return history.thenReturn(savedOrder);
                            });
                });
    }

    private Mono<Void> checkAndCompleteRoute(Long routeId) {
        return orderRepository.findByRouteId(routeId)
                .collectList()
                .flatMap(orders -> {
                    // A route is finished if all orders are in a final state
                    boolean allFinished = orders.stream().allMatch(o -> OrderLifecycle.terminal(o.status()));
                    
                    if (allFinished && !orders.isEmpty()) {
                        // Mark route as completed, but DON'T touch the orders anymore
                        return routeService.updateRouteStatusOnly(routeId, RouteStatus.COMPLETED);
                    }
                    return Mono.empty();
                });
    }
}
