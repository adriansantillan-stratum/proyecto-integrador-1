package com.ecoroute.backend.domain.exception;

/** A valid request that conflicts with the current business state. */
public class BusinessRuleException extends RuntimeException {
    public BusinessRuleException(String message) { super(message); }
}
