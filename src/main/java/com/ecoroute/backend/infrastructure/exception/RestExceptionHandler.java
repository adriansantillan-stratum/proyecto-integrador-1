package com.ecoroute.backend.infrastructure.exception;

import com.ecoroute.backend.domain.exception.ResourceNotFoundException;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import reactor.core.publisher.Mono;

@RestControllerAdvice
public class RestExceptionHandler {

    @ExceptionHandler(org.springframework.web.reactive.function.client.WebClientResponseException.class)
    public org.springframework.http.ResponseEntity<ErrorResponse> handleUpstream(org.springframework.web.reactive.function.client.WebClientResponseException ex) {
        var status=ex.getStatusCode().value()==404?HttpStatus.NOT_FOUND:HttpStatus.BAD_GATEWAY;
        return org.springframework.http.ResponseEntity.status(status).body(new ErrorResponse("La integración externa no pudo completar la operación"));
    }

    @ExceptionHandler(BusinessRuleException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Mono<ErrorResponse> handleConflict(BusinessRuleException ex) {
        return Mono.just(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Mono<ErrorResponse> handleInvalid(IllegalArgumentException ex) {
        return Mono.just(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Mono<ErrorResponse> handleIntegrity(DataIntegrityViolationException ex) {
        return Mono.just(new ErrorResponse("El registro entra en conflicto con una relación o un valor único existente"));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Mono<ErrorResponse> handleResourceNotFoundException(ResourceNotFoundException ex) {
        return Mono.just(new ErrorResponse(ex.getMessage()));
    }

    public record ErrorResponse(String message) {}
}
