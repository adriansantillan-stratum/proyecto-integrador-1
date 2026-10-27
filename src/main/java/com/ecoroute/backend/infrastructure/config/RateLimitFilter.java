package com.ecoroute.backend.infrastructure.config;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.*;
import reactor.core.publisher.Mono;
import java.util.List;

/** Atomic shared counter; authenticated users are not grouped behind the Nginx IP. */
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="ecoroute.rate-limit.enabled",havingValue="true",matchIfMissing=true)
@RequiredArgsConstructor
public class RateLimitFilter implements WebFilter {
    private final ReactiveStringRedisTemplate redis;
    @Value("${ecoroute.rate-limit.per-minute:120}") private int limit;
    private static final DefaultRedisScript<Long> COUNT=new DefaultRedisScript<>(
            "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],61) end;return n",Long.class);
    public Mono<Void> filter(ServerWebExchange exchange,WebFilterChain chain) {
        if(exchange.getRequest().getPath().value().startsWith("/actuator/health")) return chain.filter(exchange);
        String ip=exchange.getRequest().getRemoteAddress()==null?"unknown":exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();
        return exchange.getPrincipal().map(principal -> "user:"+principal.getName()).defaultIfEmpty("ip:"+ip)
                .flatMap(identity -> redis.execute(COUNT,List.of("ecoroute:rate:"+identity+":"+(System.currentTimeMillis()/60000)),List.of())
                        .next().onErrorMap(error -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Control de acceso temporalmente no disponible")))
                .flatMap(count -> {
                    if(count<=limit) return chain.filter(exchange);
                    exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                    exchange.getResponse().getHeaders().set("Retry-After","60");
                    return exchange.getResponse().setComplete();
                });
    }
}
