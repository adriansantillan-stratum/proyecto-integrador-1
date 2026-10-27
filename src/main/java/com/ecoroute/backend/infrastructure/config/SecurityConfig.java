package com.ecoroute.backend.infrastructure.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableReactiveMethodSecurity;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.http.HttpMethod;
import reactor.core.publisher.Mono;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;


@Configuration
@EnableWebFluxSecurity
@EnableReactiveMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        http
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .authorizeExchange(exchanges -> exchanges
                .pathMatchers("/actuator/health", "/v3/api-docs/**", "/webjars/**", "/swagger-ui.html", "/favicon.ico", "/ws/**").permitAll()
                
                // RBAC Protection
                .pathMatchers("/actuator/**").hasRole("ADMIN")
                .pathMatchers(HttpMethod.POST,"/routes/*/acceptance").hasRole("DRIVER")
                .pathMatchers(HttpMethod.POST,"/orders/**","/routes/**","/drivers/**","/vehicles/**").hasAnyRole("ADMIN","DISPATCHER")
                .pathMatchers(HttpMethod.PUT,"/orders/**","/routes/**","/drivers/**","/vehicles/**").hasAnyRole("ADMIN","DISPATCHER")
                .pathMatchers(HttpMethod.DELETE,"/orders/**","/routes/**","/drivers/**","/vehicles/**").hasAnyRole("ADMIN","DISPATCHER")
                .pathMatchers(HttpMethod.PATCH,"/orders/*/route","/routes/**","/drivers/**","/vehicles/**").hasAnyRole("ADMIN","DISPATCHER")
                .pathMatchers("/dashboard/**", "/api/dashboard/**").hasRole("ADMIN")
                .pathMatchers("/drivers/**", "/api/drivers/**", "/vehicles/**", "/api/vehicles/**", "/routes/**", "/api/routes/**").hasAnyRole("ADMIN", "DISPATCHER", "DRIVER")
                .pathMatchers("/gps/**", "/api/gps/**", "/delivery-proofs/**", "/api/delivery-proofs/**", "/orders/**", "/api/orders/**").hasAnyRole("ADMIN", "DRIVER", "DISPATCHER")
                .pathMatchers("/purchases/**", "/api/purchases/**").hasAnyRole("ADMIN", "DISPATCHER")
                .pathMatchers("/notifications/**", "/api/notifications/**").hasAnyRole("ADMIN", "DISPATCHER")
                .pathMatchers("/incidents/**").hasAnyRole("ADMIN", "DISPATCHER", "DRIVER")
                .pathMatchers("/improvement-actions/**").hasAnyRole("ADMIN", "DISPATCHER")
                .pathMatchers("/reports/**", "/api/reports/**").hasRole("ADMIN")
                .pathMatchers("/users/**", "/api/users/**").hasRole("ADMIN")

                .anyExchange().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(grantedAuthoritiesExtractor()))
            );
            
        return http.build();
    }

    private Converter<Jwt, Mono<AbstractAuthenticationToken>> grantedAuthoritiesExtractor() {
        JwtAuthenticationConverter jwtAuthenticationConverter = new JwtAuthenticationConverter();
        jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(new KeycloakRoleConverter());
        return new ReactiveJwtAuthenticationConverterAdapter(jwtAuthenticationConverter);
    }

    static class KeycloakRoleConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

        private static final Logger log = LoggerFactory.getLogger(KeycloakRoleConverter.class);

        @Override
        public Collection<GrantedAuthority> convert(Jwt jwt) {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess == null) {
                log.debug("Token sin claim 'realm_access' (subject: {})", jwt.getSubject());
                return Collections.emptyList();
            }

            List<String> roles = (List<String>) realmAccess.get("roles");
            if (roles == null) return Collections.emptyList();

            return roles.stream()
                    .map(role -> "ROLE_" + role)
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toList());
        }
    }
}
