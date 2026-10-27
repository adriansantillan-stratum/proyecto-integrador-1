package com.ecoroute.backend.application.services;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;
import software.amazon.awssdk.core.async.AsyncResponseTransformer;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

@Service
@Slf4j
@RequiredArgsConstructor
public class S3Service {

    private final S3AsyncClient s3AsyncClient;
    private final com.ecoroute.backend.domain.ports.out.EvidenceBackupPort backup;
    @Value("${aws.s3.local-durable-backup:false}")
    private boolean durableLocalBackup;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    /**
     * Uploads a base64 encoded image or signature to S3.
     * Returns the S3 URI of the uploaded object.
     */
    public Mono<String> uploadBase64(String prefix, String base64Content) {
        if (base64Content == null || base64Content.isBlank()) {
            return Mono.empty();
        }

        byte[] content = decodeImage(base64Content, prefix.equals("signatures") ? 2 : 10);
        boolean png=content[0]==(byte)0x89;
        String key = String.format("%s/%s.%s", prefix, UUID.randomUUID(),png?"png":"jpg");

        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(png?"image/png":"image/jpeg")
                .build();

        log.info("📤 Uploading object to S3: {}/{}", bucketName, key);

        return Mono.fromCompletionStage(s3AsyncClient.putObject(putRequest, AsyncRequestBody.fromBytes(content)))
                .then(durableLocalBackup ? backup.store(key,content,png?"image/png":"image/jpeg") : Mono.empty())
                .thenReturn(String.format("s3://%s/%s", bucketName, key))
                .doOnSuccess(uri -> log.info("✅ Uploaded successfully to: {}", uri))
                .doOnError(err -> log.error("❌ S3 upload failed: {}", err.getMessage()));
    }

    public static byte[] decodeImage(String input, int maxMb) {
        if (input == null || input.isBlank()) throw new IllegalArgumentException("La imagen es obligatoria");
        String encoded=input.contains(",") ? input.substring(input.indexOf(',')+1) : input;
        if (encoded.length() > maxMb*1024L*1024L*4/3+8) throw new IllegalArgumentException("La imagen supera el tamaño máximo");
        byte[] data;
        try { data=Base64.getDecoder().decode(encoded); }
        catch (IllegalArgumentException ex) { throw new IllegalArgumentException("La imagen no contiene base64 válido"); }
        boolean png=data.length>8 && data[0]==(byte)0x89 && data[1]==0x50 && data[2]==0x4e && data[3]==0x47;
        boolean jpeg=data.length>3 && data[0]==(byte)0xff && data[1]==(byte)0xd8 && data[2]==(byte)0xff;
        if (!png && !jpeg) throw new IllegalArgumentException("Solo se permiten imágenes PNG o JPEG");
        return data;
    }

    public Mono<byte[]> read(String uri) {
        String prefix="s3://"+bucketName+"/";
        if (uri == null || !uri.startsWith(prefix)) return Mono.error(new IllegalArgumentException("Referencia de archivo inválida"));
        String key=uri.substring(prefix.length());
        if(!key.matches("(photos|signatures)/[a-fA-F0-9-]+\\.(png|jpg)"))
            return Mono.error(new IllegalArgumentException("Clave de evidencia inválida"));
        return Mono.fromCompletionStage(s3AsyncClient.getObject(GetObjectRequest.builder()
                .bucket(bucketName).key(key).build(), AsyncResponseTransformer.toBytes()))
                .map(response -> response.asByteArray())
                .onErrorResume(error -> durableLocalBackup ? backup.read(key).switchIfEmpty(Mono.error(error)) : Mono.error(error))
                .onErrorMap(software.amazon.awssdk.services.s3.model.S3Exception.class,error -> error.statusCode()==404
                    ? new com.ecoroute.backend.domain.exception.ResourceNotFoundException("El archivo de evidencia no está disponible") : error);
    }
}
