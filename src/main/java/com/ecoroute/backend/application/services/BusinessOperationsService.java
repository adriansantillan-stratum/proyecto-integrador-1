package com.ecoroute.backend.application.services;

import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.exception.ResourceNotFoundException;
import com.ecoroute.backend.domain.model.*;
import com.ecoroute.backend.domain.model.BusinessOperations.*;
import com.ecoroute.backend.domain.model.BusinessWorkflow.Confirmation;
import com.ecoroute.backend.domain.ports.out.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

/** P04 case resolution and P05 improvement cycle. Terminal delivery history is never reopened. */
@Service
@RequiredArgsConstructor
public class BusinessOperationsService {
    private final BusinessOperationsPort operations;
    private final OrderRepository orders;
    private final RouteRepository routes;
    private final BusinessWorkflowPort workflow;
    private final OrderAuditPort orderAudit;
    public Flux<Incident> incidents() { return operations.incidents(); }
    public Mono<Incident> incident(Long id) {
        return operations.incident(id,false).switchIfEmpty(Mono.error(new ResourceNotFoundException("Incidencia no encontrada")));
    }
    @Transactional
    public Mono<Incident> report(Incident i,String actor) {
        if(i.routeId()==null) return Mono.error(new IllegalArgumentException("La incidencia requiere una ruta"));
        requireText(i.description(),5,"Describa la incidencia");
        if(!Set.of("LOW","MEDIUM","HIGH","CRITICAL").contains(i.severity()))
            return Mono.error(new IllegalArgumentException("Severidad inválida"));
        if(i.incidentType()==null || !i.incidentType().matches("[A-Z_]{3,50}"))
            return Mono.error(new IllegalArgumentException("Tipo de incidencia inválido"));
        return routes.findById(i.routeId()).switchIfEmpty(Mono.error(new ResourceNotFoundException("Ruta no encontrada")))
            .then(i.orderId()==null ? Mono.empty() : orders.findById(i.orderId())
                .switchIfEmpty(Mono.error(new ResourceNotFoundException("Pedido no encontrado")))
                .flatMap(order -> i.routeId().equals(order.routeId())?Mono.empty():Mono.error(new BusinessRuleException("El pedido no pertenece a esa ruta"))))
            .then(operations.createIncident(new Incident(null,i.routeId(),i.orderId(),i.incidentType(),i.severity(),i.description(),
                "OPEN",null,null,null,null,actor,null,null,null)))
            .flatMap(saved -> workflow.audit("P04","INCIDENT",saved.id(),"REPORTED",actor,saved.description()).thenReturn(saved));
    }
    @Transactional
    public Mono<Incident> resolve(Long id,String outcome,String reason,Long nextRoute,String actor,boolean manager) {
        requireText(reason,5,"Indique el motivo de resolución");
        if(outcome==null || !Set.of("RETRY","REPLAN","CLOSE_FAILED","CLOSE_CASE").contains(outcome))
            return Mono.error(new IllegalArgumentException("Resolución inválida"));
        if((outcome.equals("CLOSE_FAILED") || outcome.equals("CLOSE_CASE")) && !manager)
            return Mono.error(new org.springframework.security.access.AccessDeniedException("El cierre definitivo requiere jefatura"));
        return operations.incident(id,true).switchIfEmpty(Mono.error(new ResourceNotFoundException("Incidencia no encontrada")))
            .flatMap(incident -> {
                if(!"OPEN".equals(incident.status())) return outcome.equals(incident.outcome()) ? Mono.just(incident)
                    : Mono.error(new BusinessRuleException("La incidencia ya fue resuelta"));
                if(outcome.equals("CLOSE_CASE")) return finish(incident,outcome,reason,actor,null,null);
                if(incident.orderId()==null) return Mono.error(new BusinessRuleException("Use CLOSE_CASE para incidencias generales de ruta"));
                // Use route -> order lock order, matching assignment/dispatch to avoid lock inversions.
                Long target=outcome.equals("REPLAN")?nextRoute:incident.routeId();
                if(target==null) return Mono.error(new IllegalArgumentException("Seleccione la nueva ruta"));
                return routes.lockById(target).switchIfEmpty(Mono.error(new ResourceNotFoundException("Ruta destino no encontrada")))
                    .flatMap(route -> orders.lockById(incident.orderId())
                        .switchIfEmpty(Mono.error(new ResourceNotFoundException("Pedido no encontrado")))
                        .flatMap(order -> {
                            if(outcome.equals("CLOSE_FAILED")) {
                                if(!OrderLifecycle.terminal(order.status())) return Mono.error(new BusinessRuleException("Registre primero el resultado de no entrega en el pedido"));
                                if(order.status()==OrderStatus.DELIVERED) return Mono.error(new BusinessRuleException("Un pedido entregado no se cierra como fallido; use CLOSE_CASE"));
                                return finish(incident,outcome,reason,actor,null,null);
                            }
                            if(order.status()!=OrderStatus.FAILED && order.status()!=OrderStatus.RETURNED)
                                return Mono.error(new BusinessRuleException("Solo se reintentan pedidos fallidos o devueltos"));
                            RouteStatus expected=outcome.equals("RETRY")?RouteStatus.IN_PROGRESS:RouteStatus.PLANNED;
                            if(route.status()!=expected) return Mono.error(new BusinessRuleException(outcome.equals("RETRY")
                                ? "La jornada terminó; reprograme en una ruta planificada" : "La ruta destino debe estar planificada"));
                            return workflow.requireConfirmed(order.id()).then(Mono.defer(() -> {
                                OffsetDateTime now=OffsetDateTime.now();
                                Order attempt=new Order(null,"RE-"+UUID.randomUUID(),order.trackingNumber(),route.id(),
                                    outcome.equals("RETRY")?OrderStatus.IN_TRANSIT:OrderStatus.ASSIGNED,
                                    order.recipientName(),order.recipientPhone(),order.recipientEmail(),order.deliveryAddress(),
                                    order.deliveryCity(),order.deliveryDistrict(),order.latitude(),order.longitude(),order.priority(),
                                    null,null,now,now);
                                // A new promise window must be agreed on replan; never silently reuse an expired window.
                                return orders.save(attempt).flatMap(saved -> operations.linkAttempt(order.id(),saved.id(),id)
                                    .then(copyConfirmation(order.id(),saved.id(),actor,outcome.equals("RETRY")))
                                    .then(outcome.equals("REPLAN")?workflow.invalidate(route.id()):Mono.empty())
                                    .then(orderAudit.record(saved,"Nuevo intento de "+order.trackingNumber()+": "+reason))
                                    .then(finish(incident,outcome,reason,actor,route.id(),saved.id())));
                            }));
                        }));
            });
    }
    private Mono<Void> copyConfirmation(Long source,Long target,String actor,boolean sameJourney) {
        return workflow.confirmation(source).flatMap(c -> workflow.saveConfirmation(new Confirmation(target,c.recipientRuc(),
            sameJourney && c.customerAccepted(),c.addressVerified(),c.coverageVerified(),
            "Reintento vinculado al pedido "+source+"; "+(sameJourney?"misma jornada":"requiere nueva aceptación del cliente"),actor,null))).then();
    }
    private Mono<Incident> finish(Incident i,String outcome,String reason,String actor,Long next,Long retry) {
        return operations.resolve(i.id(),outcome,reason,actor,next,retry)
            .flatMap(saved -> workflow.audit("P04","INCIDENT",i.id(),outcome,actor,reason+"; retry="+retry).thenReturn(saved));
    }
    public Flux<Improvement> improvements() { return operations.improvements(); }
    @Transactional
    public Mono<Improvement> createAction(Improvement i,String actor) {
        requireText(i.title(),5,"Indique el título");requireText(i.cause(),5,"Indique la causa");
        requireText(i.ownerName(),3,"Indique el responsable");
        if(i.dueDate()==null || i.metricCode()==null || !Set.of("IID","CHR","TDE","SUCCESS","ONTIME").contains(i.metricCode()))
            return Mono.error(new IllegalArgumentException("Se requiere fecha e indicador válido"));
        validateNumber(i.baselineValue());validateNumber(i.targetValue());
        return operations.createImprovement(new Improvement(null,i.title(),i.cause(),i.ownerName(),i.dueDate(),i.metricCode(),
            i.baselineValue(),i.targetValue(),null,"OPEN",null,actor,null))
            .flatMap(saved -> workflow.audit("P05","IMPROVEMENT",saved.id(),"CREATED",actor,saved.title()).thenReturn(saved));
    }
    @Transactional
    public Mono<Improvement> updateAction(Long id,String status,Double result,String note,String actor,boolean manager) {
        requireText(note,5,"Documente la evidencia o motivo");validateNumber(result);
        if(status==null || !Set.of("IN_PROGRESS","VERIFIED","DISCARDED").contains(status))
            return Mono.error(new IllegalArgumentException("Estado inválido"));
        if((status.equals("VERIFIED") || status.equals("DISCARDED")) && !manager)
            return Mono.error(new org.springframework.security.access.AccessDeniedException("Jefatura verifica o descarta la acción"));
        if(status.equals("VERIFIED") && result==null) return Mono.error(new IllegalArgumentException("Registre el resultado medido"));
        return operations.improvement(id,true).switchIfEmpty(Mono.error(new ResourceNotFoundException("Acción no encontrada")))
            .flatMap(current -> {
                if(Set.of("VERIFIED","DISCARDED").contains(current.status()))
                    return Mono.error(new BusinessRuleException("La acción está cerrada"));
                if(status.equals("VERIFIED") && !current.status().equals("IN_PROGRESS"))
                    return Mono.error(new BusinessRuleException("Ejecute la acción antes de verificar su resultado"));
                return operations.updateImprovement(id,status,result,note,status.equals("VERIFIED")?actor:null)
                    .flatMap(saved -> workflow.audit("P05","IMPROVEMENT",id,status,actor,note).thenReturn(saved));
            });
    }
    private void requireText(String value,int min,String message) {
        if(value==null || value.trim().length()<min) throw new IllegalArgumentException(message);
    }
    private void validateNumber(Double number) {
        if(number!=null && (!Double.isFinite(number) || number<0 || number>100))
            throw new IllegalArgumentException("El indicador debe estar entre 0 y 100");
    }
}
