package com.ecoroute.backend.infrastructure.input.rest;
import com.ecoroute.backend.infrastructure.security.OperationalAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import java.util.Map;
@RestController
@RequestMapping("/session")
@RequiredArgsConstructor
public class SessionController {
    private final OperationalAccess access;
    @GetMapping("/me")
    public Mono<Map<String,Object>> me() {
        return access.authentication().flatMap(a -> access.managesOperation().flatMap(manager ->
            manager ? Mono.just(Map.of("subject",a.getName(),"roles",a.getAuthorities())) : access.driverId()
                .map(id -> Map.of("subject",a.getName(),"driverId",id,"roles",a.getAuthorities()))));
    }
}
