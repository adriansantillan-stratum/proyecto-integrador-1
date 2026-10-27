package com.ecoroute.backend.application.services;

import com.ecoroute.backend.domain.model.*;
import com.ecoroute.backend.domain.model.BusinessWorkflow.*;
import com.ecoroute.backend.domain.ports.out.*;
import com.ecoroute.backend.domain.exception.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;

@Service
@RequiredArgsConstructor
public class BusinessWorkflowService {
    private final BusinessWorkflowPort workflow;
    private final OrderRepository orders;
    private final RouteRepository routes;
    private final VehicleRepository vehicles;
    private final DriverRepository drivers;
    private final OrderAuditPort orderAudit;

    @Transactional
    public Mono<Confirmation> confirm(Confirmation input) {
        if(input.agreementNote()==null || input.agreementNote().trim().length()<5)
            return Mono.error(new IllegalArgumentException("Describa las condiciones acordadas con el cliente"));
        if(input.recipientRuc()!=null && !input.recipientRuc().isBlank() && !input.recipientRuc().matches("[0-9]{11}"))
            return Mono.error(new IllegalArgumentException("El RUC debe contener once dígitos"));
        return orders.lockById(input.orderId()).switchIfEmpty(Mono.error(new ResourceNotFoundException("Pedido no encontrado")))
            .flatMap(order -> {
                if(order.status()!=OrderStatus.PENDING && order.status()!=OrderStatus.ASSIGNED)
                    return Mono.error(new BusinessRuleException("No se cambian las condiciones de un pedido despachado"));
                if(input.complete() && (order.latitude()==null || order.longitude()==null
                    || !Double.isFinite(order.latitude()) || !Double.isFinite(order.longitude())
                    || Math.abs(order.latitude())>90 || Math.abs(order.longitude())>180
                    || (order.latitude()==0 && order.longitude()==0)))
                    return Mono.error(new BusinessRuleException("Corrija la ubicación antes de confirmar la dirección"));
                return workflow.saveConfirmation(input).flatMap(saved -> workflow.invalidate(order.routeId())
                    .then(workflow.audit("P01","ORDER",order.id(),"COMMERCIAL_REVIEW",input.confirmedBy(),input.agreementNote()))
                    .then(orderAudit.record(order,"Revisión comercial: "+input.agreementNote())).thenReturn(saved));
            });
    }
    @Transactional
    public Mono<Review> approve(Long id,Double weight,String note,String actor) {
        if(weight==null || !Double.isFinite(weight) || weight<=0 || note==null || note.trim().length()<5)
            return Mono.error(new IllegalArgumentException("Indique peso de carga positivo y observaciones del plan"));
        return plannedRoute(id).flatMap(route -> drivers.findById(route.driverId())
            .filter(driver -> Boolean.TRUE.equals(driver.isActive()))
            .switchIfEmpty(Mono.error(new BusinessRuleException("Conductor no habilitado")))
            .then(vehicles.findById(route.vehicleId()))
            .switchIfEmpty(Mono.error(new BusinessRuleException("Vehículo no encontrado")))
            .flatMap(vehicle -> {
                if(!Boolean.TRUE.equals(vehicle.isActive()) || vehicle.capacityKg()==null || vehicle.capacityKg()<weight)
                    return Mono.error(new BusinessRuleException("La carga excede la capacidad o el vehículo no está habilitado"));
                return orders.findByRouteId(id).collectList().flatMap(list -> {
                    if(list.isEmpty()) return Mono.error(new BusinessRuleException("Asigne pedidos antes de revisar la jornada"));
                    return reactor.core.publisher.Flux.fromIterable(list).concatMap(order -> workflow.requireConfirmed(order.id())).then()
                        .then(workflow.approve(id,weight,actor,note))
                        .then(workflow.audit("P02","ROUTE",id,"PLAN_APPROVED",actor,"Carga kg="+weight+"; "+note)).then(workflow.review(id));
                });
            }));
    }
    @Transactional
    public Mono<Review> accept(Long id,Long driverId,String actor) {
        return plannedRoute(id).flatMap(route -> {
            if(!route.driverId().equals(driverId)) return Mono.error(new BusinessRuleException("La hoja no corresponde al conductor"));
            return workflow.review(id).flatMap(review -> {
                if(!review.approved()) return Mono.error(new BusinessRuleException("La jefatura debe aprobar primero el plan"));
                return workflow.accept(id,actor).then(workflow.audit("P02","ROUTE",id,"DRIVER_ACCEPTED",actor,"El conductor revisó hoja, carga y vehículo"))
                    .then(workflow.review(id));
            });
        });
    }
    private Mono<Route> plannedRoute(Long id) {
        return routes.lockById(id).switchIfEmpty(Mono.error(new ResourceNotFoundException("Ruta no encontrada")))
            .flatMap(route -> route.status()==RouteStatus.PLANNED ? Mono.just(route)
                : Mono.error(new BusinessRuleException("La ruta ya no está en planificación")));
    }
}
