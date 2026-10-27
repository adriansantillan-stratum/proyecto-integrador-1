package com.ecoroute.backend.infrastructure.input.rest;
import com.ecoroute.backend.infrastructure.security.KeycloakAdministration;
import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.*;
import java.util.*;
@RestController
@RequestMapping("/users/identities")
@RequiredArgsConstructor
public class IdentityController {
    private final KeycloakAdministration identity;
    private final OperationalAccess access;
    @GetMapping public Flux<Map<String,Object>> list() { return identity.identities(); }
    @PutMapping("/{id}/roles") public Mono<Void> roles(@PathVariable String id,@RequestBody RolesRequest request) {
        return access.authentication().flatMap(actor -> identity.roles(id,request.roles(),request.driverId(),actor.getName()));
    }
    @PutMapping("/{id}/enabled") public Mono<Void> enabled(@PathVariable String id,@RequestBody EnabledRequest request) {
        return access.authentication().flatMap(actor -> identity.enabled(id,request.enabled(),actor.getName()));
    }
    public record RolesRequest(List<String> roles,Long driverId) {}
    public record EnabledRequest(boolean enabled) {}
}
