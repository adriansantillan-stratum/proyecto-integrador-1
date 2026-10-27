package com.ecoroute.backend.domain.model;

public record UserRole(
    Long id,
    String userExternalId,
    String username,
    Long roleId,
    String roleName
) {}
