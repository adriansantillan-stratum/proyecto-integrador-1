package com.ecoroute.backend.domain.ports.out;
import java.time.OffsetDateTime;
import reactor.core.publisher.Mono;
public interface ProofIntegrityPort {
    Mono<Void> record(Long proofId,String imageHash,String signatureHash,OffsetDateTime capturedAt);
}
