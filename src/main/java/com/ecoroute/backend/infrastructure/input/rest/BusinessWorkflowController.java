package com.ecoroute.backend.infrastructure.input.rest;
import com.ecoroute.backend.application.services.BusinessWorkflowService;
import com.ecoroute.backend.domain.model.BusinessWorkflow.*;
import com.ecoroute.backend.domain.ports.out.BusinessWorkflowPort;
import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
public class BusinessWorkflowController {
    private final BusinessWorkflowService service;
    private final BusinessWorkflowPort workflow;
    private final OperationalAccess access;
    @GetMapping("/orders/{id}/business-data")
    public Mono<Confirmation> confirmation(@PathVariable Long id) {
        return access.requireOrder(id).then(workflow.confirmation(id));
    }
    @PatchMapping("/orders/{id}/business-data")
    @PreAuthorize("hasAnyRole('ADMIN','DISPATCHER')")
    public Mono<Confirmation> confirm(@PathVariable Long id,@Valid @RequestBody ConfirmationRequest request) {
        return access.authentication().flatMap(actor -> service.confirm(new Confirmation(id,request.recipientRuc(),
            request.customerAccepted(),request.addressVerified(),request.coverageVerified(),request.agreementNote(),actor.getName(),null)));
    }
    @GetMapping("/routes/{id}/review")
    public Mono<Review> review(@PathVariable Long id) {
        return access.requireRoute(id).then(workflow.review(id));
    }
    @PostMapping("/routes/{id}/review")
    @PreAuthorize("hasRole('ADMIN')")
    public Mono<Review> approve(@PathVariable Long id,@Valid @RequestBody ReviewRequest request) {
        return access.authentication().flatMap(actor -> service.approve(id,request.loadWeightKg(),request.note(),actor.getName()));
    }
    @PostMapping("/routes/{id}/acceptance")
    @PreAuthorize("hasRole('DRIVER')")
    public Mono<Review> accept(@PathVariable Long id) {
        return access.driverId().zipWith(access.authentication())
            .flatMap(pair -> service.accept(id,pair.getT1(),pair.getT2().getName()));
    }
    public record ConfirmationRequest(String recipientRuc,boolean customerAccepted,boolean addressVerified,
            boolean coverageVerified,@NotBlank @Size(min=5,max=2000) String agreementNote) {}
    public record ReviewRequest(@AssertTrue boolean capacityVerified,@AssertTrue boolean windowsVerified,
            @AssertTrue boolean vehicleChecked,@NotNull @Positive Double loadWeightKg,@NotBlank @Size(min=5,max=2000) String note) {}
}
