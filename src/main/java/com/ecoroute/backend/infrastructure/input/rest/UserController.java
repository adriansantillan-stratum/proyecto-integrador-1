package com.ecoroute.backend.infrastructure.input.rest;

import com.ecoroute.backend.infrastructure.output.persistence.SpringDataUserRoleRepository;
import com.ecoroute.backend.infrastructure.output.persistence.UserRoleEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final SpringDataUserRoleRepository userRoleRepository;

    @GetMapping
    public Flux<UserRoleEntity> getAllUsers() {
        return userRoleRepository.findAll();
    }

    @PostMapping
    public Mono<UserRoleEntity> assignRole(@RequestBody UserRoleRequest request) {
        return Mono.error(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.GONE,"Use /users/identities para administrar roles efectivos de Keycloak"));
    }

    @DeleteMapping("/{id}")
    public Mono<Void> removeRole(@PathVariable Long id) {
        return Mono.error(new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.GONE,"Use /users/identities para administrar roles efectivos de Keycloak"));
    }
}
