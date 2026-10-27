package com.ecoroute.backend.infrastructure.input.rest;

public record UserRoleRequest(
    String userExternalId,
    Long roleId
) {}
