package com.ecoroute.backend.infrastructure.security;

import com.ecoroute.backend.domain.exception.BusinessRuleException;
import com.ecoroute.backend.domain.ports.out.BusinessWorkflowPort;
import com.ecoroute.backend.domain.ports.out.DriverRepository;
import com.ecoroute.backend.domain.model.Driver;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/** Keycloak is the authority. Local auth_user_role is retained only as legacy data. */
@Service
@RequiredArgsConstructor
public class KeycloakAdministration {
    private final DriverRepository drivers;
    private final BusinessWorkflowPort audit;
    private final ReactiveStringRedisTemplate redis;
    @Value("${keycloak.admin-base-url:http://localhost:8080}") private String base;
    @Value("${keycloak.realm:ecoroute}") private String realm;
    @Value("${keycloak.admin-client-id:ecoroute-operations-service}") private String clientId;
    @Value("${keycloak.admin-client-secret:}") private String secret;
    private final WebClient client=WebClient.builder().build();
    private static final Set<String> APP_ROLES=Set.of("ADMIN","DISPATCHER","DRIVER");

    private Mono<String> serviceToken() {
        if(secret.isBlank()) return Mono.error(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Configure el cliente de administración de identidad"));
        return client.post().uri(base+"/realms/"+realm+"/protocol/openid-connect/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(BodyInserters.fromFormData("grant_type","client_credentials").with("client_id",clientId).with("client_secret",secret))
            .retrieve().bodyToMono(JsonNode.class).timeout(Duration.ofSeconds(10)).map(node -> node.path("access_token").asText());
    }
    private String admin(String path) { return base+"/admin/realms/"+realm+path; }
    private Mono<JsonNode> get(String path,String token) {
        return client.get().uri(admin(path)).headers(h -> h.setBearerAuth(token)).retrieve().bodyToMono(JsonNode.class).timeout(Duration.ofSeconds(10));
    }
    private Mono<JsonNode> humanUser(String userId,String token) {
        if(userId==null || !userId.matches("[a-fA-F0-9-]{36}")) return Mono.error(new IllegalArgumentException("Identificador de identidad inválido"));
        return get("/users/"+userId,token).flatMap(user -> user.path("username").asText().startsWith("service-account-")
            ? Mono.error(new BusinessRuleException("No se administran cuentas técnicas desde el panel")) : Mono.just(user));
    }
    public Flux<Map<String,Object>> identities() {
        return serviceToken().flatMapMany(token -> get("/users?max=100",token).flatMapMany(json -> Flux.fromIterable(json))
            .filter(user -> !user.path("username").asText().startsWith("service-account-"))
            .concatMap(user -> get("/users/"+user.path("id").asText()+"/role-mappings/realm",token)
                .zipWith(drivers.findAll().filter(driver -> user.path("id").asText().equals(driver.externalId())).next()
                    .map(driver -> Optional.of(driver.id())).defaultIfEmpty(Optional.empty()))
                .map(pair -> {
                    Map<String,Object> row=new LinkedHashMap<>();
                    row.put("id",user.path("id").asText());row.put("username",user.path("username").asText());
                    row.put("enabled",user.path("enabled").asBoolean());row.put("firstName",user.path("firstName").asText());row.put("lastName",user.path("lastName").asText());
                    List<String> roles=new ArrayList<>();pair.getT1().forEach(role -> {if(APP_ROLES.contains(role.path("name").asText()))roles.add(role.path("name").asText());});
                    row.put("roles",roles);row.put("driverId",pair.getT2().orElse(null));return row;
                })));
    }
    public Mono<Void> roles(String userId,List<String> requested,Long driverId,String actor) {
        if(requested==null || requested.isEmpty() || !APP_ROLES.containsAll(requested))
            return Mono.error(new IllegalArgumentException("Seleccione roles ADMIN, DISPATCHER o DRIVER"));
        if(userId.equals(actor) && !requested.contains("ADMIN"))
            return Mono.error(new BusinessRuleException("No puede retirarse su propio acceso de administrador"));
        return serviceToken().flatMap(token -> humanUser(userId,token).then(get("/roles",token))
            .flatMap(all -> {
                List<JsonNode> target=new ArrayList<>();all.forEach(role -> {if(requested.contains(role.path("name").asText()))target.add(role);});
                if(target.size()!=new HashSet<>(requested).size()) return Mono.error(new BusinessRuleException("Faltan roles de aplicación en Keycloak"));
                return validateBinding(userId,driverId,requested,token).then(get("/users/"+userId+"/role-mappings/realm",token))
                    .flatMap(current -> {
                        List<JsonNode> remove=new ArrayList<>();current.forEach(role -> {if(APP_ROLES.contains(role.path("name").asText()) && !requested.contains(role.path("name").asText())) remove.add(role);});
                        Mono<Void> delete=remove.isEmpty()?Mono.empty():client.method(org.springframework.http.HttpMethod.DELETE)
                            .uri(admin("/users/"+userId+"/role-mappings/realm")).headers(h -> h.setBearerAuth(token))
                            .contentType(MediaType.APPLICATION_JSON).bodyValue(remove).retrieve().toBodilessEntity().then();
                        return delete.then(client.post().uri(admin("/users/"+userId+"/role-mappings/realm"))
                            .headers(h -> h.setBearerAuth(token)).contentType(MediaType.APPLICATION_JSON).bodyValue(target).retrieve().toBodilessEntity())
                            .then(revoke(userId,token)).then(audit.audit("P08","IDENTITY",0L,"ROLES_CHANGED",actor,"subject="+userId+"; roles="+requested));
                    });
            }));
    }
    private Mono<Void> validateBinding(String userId,Long driverId,List<String> roles,String token) {
        if(!roles.contains("DRIVER")) return Mono.empty();
        if(driverId==null) return drivers.findAll().filter(driver -> userId.equals(driver.externalId())).hasElements()
                .flatMap(found -> found?Mono.empty():Mono.error(new IllegalArgumentException("Vincule la cuenta con un conductor")));
        return drivers.findById(driverId).switchIfEmpty(Mono.error(new IllegalArgumentException("Conductor no encontrado")))
            .flatMap(driver -> {
                if(userId.equals(driver.externalId())) return Mono.empty();
                Mono<Void> unbound=driver.externalId()==null?Mono.empty():client.get().uri(admin("/users/"+driver.externalId()))
                    .headers(h -> h.setBearerAuth(token)).exchangeToMono(response -> response.statusCode().value()==404?Mono.empty()
                        : response.releaseBody().then(Mono.error(new BusinessRuleException("El conductor ya está vinculado con otra cuenta"))));
                return unbound.then(drivers.save(new Driver(driver.id(),userId,driver.firstName(),driver.lastName(),driver.licenseNumber(),
                    driver.phoneNumber(),driver.email(),driver.isActive(),driver.createdAt(),java.time.OffsetDateTime.now()))).then();
            });
    }
    private Mono<Void> revoke(String userId,String token) {
        return redis.opsForValue().set("ecoroute:revoked:"+userId,Long.toString(Instant.now().getEpochSecond()),Duration.ofDays(2))
            .then(client.post().uri(admin("/users/"+userId+"/logout")).headers(h -> h.setBearerAuth(token)).retrieve().toBodilessEntity()).then();
    }
    public Mono<Void> enabled(String userId,boolean enabled,String actor) {
        if(userId.equals(actor) && !enabled) return Mono.error(new BusinessRuleException("No puede deshabilitar su propia cuenta"));
        return serviceToken().flatMap(token -> humanUser(userId,token).then(client.put().uri(admin("/users/"+userId)).headers(h -> h.setBearerAuth(token))
            .contentType(MediaType.APPLICATION_JSON).bodyValue(Map.of("enabled",enabled)).retrieve().toBodilessEntity()
            .then(revoke(userId,token)).then(audit.audit("P08","IDENTITY",0L,"ENABLED_CHANGED",actor,"subject="+userId+"; enabled="+enabled))));
    }
}
