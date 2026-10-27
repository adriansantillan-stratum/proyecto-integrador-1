package com.ecoroute.backend.infrastructure.output.persistence;
import com.ecoroute.backend.domain.ports.out.ProofIntegrityPort;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import java.time.OffsetDateTime;
@Component
@RequiredArgsConstructor
public class R2dbcProofIntegrityAdapter implements ProofIntegrityPort {
    private final DatabaseClient db;
    public Mono<Void> record(Long id,String photo,String signature,OffsetDateTime capturedAt) {
        return db.sql("UPDATE delivery_proofs SET image_sha256=:photo,signature_sha256=:signature,captured_at=:captured WHERE id=:id AND image_sha256 IS NULL")
                .bind("id",id).bind("photo",photo).bind("signature",signature).bind("captured",capturedAt)
                .fetch().rowsUpdated().then();
    }
}
