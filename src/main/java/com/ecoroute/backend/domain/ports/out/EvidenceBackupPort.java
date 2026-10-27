package com.ecoroute.backend.domain.ports.out;
import reactor.core.publisher.Mono;
/** Optional durable development backup for an ephemeral S3 emulator. Not a production S3 substitute. */
public interface EvidenceBackupPort {
    Mono<Void> store(String key,byte[] content,String mediaType);
    Mono<byte[]> read(String key);
}
