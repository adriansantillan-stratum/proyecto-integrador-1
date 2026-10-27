package com.ecoroute.backend.application.services;
import com.ecoroute.backend.domain.ports.out.EvidenceBackupPort;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.core.async.AsyncResponseTransformer;
import java.util.concurrent.CompletableFuture;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
class LocalEvidenceDurabilityTest {
    @Test void developmentReadRecoversOriginalBytesAfterS3EmulatorLoss() {
        S3AsyncClient client=mock(S3AsyncClient.class);EvidenceBackupPort backup=mock(EvidenceBackupPort.class);
        S3Service service=new S3Service(client,backup);
        ReflectionTestUtils.setField(service,"bucketName","ecoroute-proofs");
        ReflectionTestUtils.setField(service,"durableLocalBackup",true);
        String key="photos/12345678-1234-1234-1234-123456789012.png";
        when(client.getObject(any(GetObjectRequest.class),any(AsyncResponseTransformer.class)))
            .thenReturn(CompletableFuture.failedFuture(NoSuchKeyException.builder().statusCode(404).message("Ephemeral emulator reset").build()));
        byte[] original=new byte[]{1,2,3};when(backup.read(key)).thenReturn(Mono.just(original));
        StepVerifier.create(service.read("s3://ecoroute-proofs/"+key)).expectNext(original).verifyComplete();
    }
    @Test void productionReadDoesNotSilentlyFallBackToLocalStore() {
        S3AsyncClient client=mock(S3AsyncClient.class);EvidenceBackupPort backup=mock(EvidenceBackupPort.class);
        S3Service service=new S3Service(client,backup);ReflectionTestUtils.setField(service,"bucketName","ecoroute-proofs");
        when(client.getObject(any(GetObjectRequest.class),any(AsyncResponseTransformer.class)))
            .thenReturn(CompletableFuture.failedFuture(NoSuchKeyException.builder().statusCode(404).build()));
        StepVerifier.create(service.read("s3://ecoroute-proofs/photos/1234.png"))
            .expectError(com.ecoroute.backend.domain.exception.ResourceNotFoundException.class).verify();verifyNoInteractions(backup);
    }
    @Test void nonProofKeysAreRejected() {
        S3AsyncClient client=mock(S3AsyncClient.class);EvidenceBackupPort backup=mock(EvidenceBackupPort.class);
        S3Service service=new S3Service(client,backup);ReflectionTestUtils.setField(service,"bucketName","ecoroute-proofs");
        StepVerifier.create(service.read("s3://ecoroute-proofs/photos/../../secret.png")).expectError(IllegalArgumentException.class).verify();
        verifyNoInteractions(client,backup);
    }
}
