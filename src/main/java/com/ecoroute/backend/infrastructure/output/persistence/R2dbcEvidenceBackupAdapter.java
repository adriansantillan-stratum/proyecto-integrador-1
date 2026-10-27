package com.ecoroute.backend.infrastructure.output.persistence;
import com.ecoroute.backend.domain.ports.out.EvidenceBackupPort;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
@Component
@RequiredArgsConstructor
public class R2dbcEvidenceBackupAdapter implements EvidenceBackupPort {
    private final DatabaseClient db;
    public Mono<Void> store(String key,byte[] content,String mediaType) {
        return db.sql("INSERT INTO local_evidence_backups(object_key,content,media_type) VALUES(:key,:content,:type) ON CONFLICT(object_key) DO NOTHING")
            .bind("key",key).bind("content",content).bind("type",mediaType).fetch().rowsUpdated().then();
    }
    public Mono<byte[]> read(String key) {
        return db.sql("SELECT content FROM local_evidence_backups WHERE object_key=:key").bind("key",key)
            .map((row,metadata)->row.get("content",byte[].class)).one();
    }
}
