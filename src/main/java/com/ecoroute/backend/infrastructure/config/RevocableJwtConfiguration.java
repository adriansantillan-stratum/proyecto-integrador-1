package com.ecoroute.backend.infrastructure.config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.security.oauth2.jwt.*;

/** Validates issuer, signature and expiry, then rejects tokens revoked by access administration. */
@Configuration
public class RevocableJwtConfiguration {
    @Bean
    public ReactiveJwtDecoder jwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String keys,
            ReactiveStringRedisTemplate redis) {
        NimbusReactiveJwtDecoder delegate=NimbusReactiveJwtDecoder.withJwkSetUri(keys).build();
        delegate.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
        return token -> delegate.decode(token).flatMap(jwt -> redis.opsForValue().get("ecoroute:revoked:"+jwt.getSubject())
                .defaultIfEmpty("0").flatMap(value -> {
                    long revoked=Long.parseLong(value);
                    if(jwt.getIssuedAt()==null || jwt.getIssuedAt().getEpochSecond()<=revoked)
                        return reactor.core.publisher.Mono.error(new BadJwtException("La sesión fue revocada; vuelva a iniciar sesión"));
                    return reactor.core.publisher.Mono.just(jwt);
                }));
    }
}
