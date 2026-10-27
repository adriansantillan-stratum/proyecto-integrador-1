package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.application.services.BusinessOperationsService;
import com.ecoroute.backend.domain.model.BusinessOperations.*;
import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
public class BusinessOperationsController {
    private final BusinessOperationsService service;
    private final OperationalAccess access;
    @GetMapping("/incidents")
    public Flux<Incident> incidents() {
        return service.incidents().filterWhen(i -> i.routeId()==null ? access.managesOperation()
            : access.requireRoute(i.routeId()).map(r -> true).onErrorResume(org.springframework.security.access.AccessDeniedException.class,e -> Mono.just(false)));
    }
    @PostMapping("/incidents")
    public Mono<Incident> report(@RequestBody Incident request) {
        if(request.routeId()==null) return Mono.error(new IllegalArgumentException("Seleccione la ruta"));
        return access.requireRoute(request.routeId()).then(access.authentication()).flatMap(a -> service.report(request,a.getName()));
    }
    @PatchMapping("/incidents/{id}/resolution")
    @PreAuthorize("hasAnyRole('ADMIN','DISPATCHER')")
    public Mono<Incident> resolve(@PathVariable Long id,@RequestBody Resolution r) {
        return access.authentication().flatMap(a -> service.resolve(id,r.outcome(),r.reason(),r.nextRouteId(),a.getName(),
            a.getAuthorities().stream().anyMatch(role -> role.getAuthority().equals("ROLE_ADMIN"))));
    }
    public record Resolution(String outcome,String reason,Long nextRouteId) {}
    @GetMapping("/improvement-actions")
    @PreAuthorize("hasAnyRole('ADMIN','DISPATCHER')")
    public Flux<Improvement> improvements() { return service.improvements(); }
    @PostMapping("/improvement-actions")
    @PreAuthorize("hasAnyRole('ADMIN','DISPATCHER')")
    public Mono<Improvement> create(@RequestBody Improvement request) {
        return access.authentication().flatMap(a -> service.createAction(request,a.getName()));
    }
    @PatchMapping("/improvement-actions/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DISPATCHER')")
    public Mono<Improvement> update(@PathVariable Long id,@RequestBody ActionUpdate r) {
        return access.authentication().flatMap(a -> service.updateAction(id,r.status(),r.resultValue(),r.note(),a.getName(),
            a.getAuthorities().stream().anyMatch(role -> role.getAuthority().equals("ROLE_ADMIN"))));
    }
    public record ActionUpdate(String status,Double resultValue,String note) {}
}
