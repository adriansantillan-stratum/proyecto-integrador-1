package com.ecoroute.backend.infrastructure.input.websocket;

import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.ReactiveRedisMessageListenerContainer;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.*;
import reactor.core.publisher.Mono;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** First frame authenticates the subscription. No position is emitted before authorization. */
@Component
@RequiredArgsConstructor
public class GpsWebSocketHandler implements WebSocketHandler {
    private final ReactiveJwtDecoder decoder;
    private final OperationalAccess access;
    private final ReactiveStringRedisTemplate redis;
    private final ReactiveRedisConnectionFactory connections;
    private final ObjectMapper mapper;

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        var firstFrame=new java.util.concurrent.atomic.AtomicBoolean();
        // next() cancels Reactor Netty's inbound subscription and closes the socket.
        // switchOnFirst keeps one inbound subscriber alive throughout the session.
        Mono<Void> channel=session.receive().map(WebSocketMessage::getPayloadAsText)
            .switchOnFirst((signal,inbound) -> {
                if(!signal.hasValue()) return session.close(CloseStatus.POLICY_VIOLATION);
                firstFrame.set(true);
                return Mono.fromCallable(() -> mapper.readTree(signal.get()))
                .flatMap(json -> decoder.decode(json.path("accessToken").asText()).flatMap(jwt -> {
                    Long vehicle=json.path("vehicleId").asLong();
                    Map<String,Object> realm=jwt.getClaim("realm_access");
                    Object raw=realm==null?null:realm.get("roles");
                    List<SimpleGrantedAuthority> roles=raw instanceof List<?> values ? values.stream()
                            .filter(String.class::isInstance).map(x -> new SimpleGrantedAuthority("ROLE_"+x)).toList() : List.of();
                    if(roles.stream().noneMatch(role -> List.of("ROLE_ADMIN","ROLE_DISPATCHER","ROLE_DRIVER").contains(role.getAuthority())))
                        return session.close(CloseStatus.POLICY_VIOLATION);
                    var auth=new JwtAuthenticationToken(jwt,roles);
                    return access.requireVehicle(vehicle).then(Mono.defer(() -> {
                        var listener=new ReactiveRedisMessageListenerContainer(connections);
                        Duration remaining=Duration.between(Instant.now(),jwt.getExpiresAt());
                        if(remaining.isNegative() || remaining.isZero()) return session.close(CloseStatus.POLICY_VIOLATION);
                        return session.send(listener.receive(ChannelTopic.of("ecoroute:gps:"+vehicle))
                                .map(message -> session.textMessage(message.getMessage())).take(remaining))
                                .then(session.close(CloseStatus.POLICY_VIOLATION))
                                .and(inbound.then())
                                .doFinally(termination -> listener.destroy());
                    })).contextWrite(ReactiveSecurityContextHolder.withAuthentication(auth));
                })).onErrorResume(error -> session.close(CloseStatus.POLICY_VIOLATION));
            }).then();
        Mono<Void> authenticationDeadline=Mono.delay(Duration.ofSeconds(5)).flatMap(ignored ->
            firstFrame.get()?Mono.empty():session.close(CloseStatus.POLICY_VIOLATION));
        return Mono.when(channel,authenticationDeadline);
    }
    public Mono<Void> broadcastLocation(Long vehicleId,double latitude,double longitude,double speedKmh) {
        return Mono.fromCallable(() -> mapper.writeValueAsString(Map.of("vehicleId",vehicleId,
                "latitude",latitude,"longitude",longitude,"speedKmh",speedKmh,"timestamp",System.currentTimeMillis())))
                .flatMap(json -> redis.convertAndSend("ecoroute:gps:"+vehicleId,json)).then();
    }
}
