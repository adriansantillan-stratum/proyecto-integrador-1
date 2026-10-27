
package com.ecoroute.backend;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication
@RequiredArgsConstructor
@Slf4j
public class EcorouteBackendApplication {

    private final Environment environment;

    @PostConstruct
    public void init() {
        TimeZone.setDefault(TimeZone.getTimeZone("America/Lima"));
        log.info("Default TimeZone set to America/Lima");
    }

    public static void main(String[] args) {
        SpringApplication.run(EcorouteBackendApplication.class, args);
    }

    @EventListener
    public void handleContextRefresh(ContextRefreshedEvent event) {
        String[] activeProfiles = environment.getActiveProfiles();

        // Banner principal
        log.info("""
            
            ═══════════════════════════════════════════════════════════
                    MS-ECOROUTE-LOGISTICA INICIADO
            ═══════════════════════════════════════════════════════════
            """);

        log.info("Perfiles activos: {}",
                activeProfiles.length > 0 ? String.join(", ", activeProfiles) : "default");

        // Si no hay perfiles activos, usar 'default'
        if (activeProfiles.length == 0) {
            log.warn("⚠️ Ningún perfil activo - usando perfil 'default'");
            log.warn("⚠️ Es recomendable especificar un perfil explícito (local, docker, prod)");
            return;
        }

        // Mensajes específicos por perfil
        if (environment.acceptsProfiles(Profiles.of("local"))) {
            logLocalEnvironment();
        } else if (environment.acceptsProfiles(Profiles.of("docker"))) {
            logDockerEnvironment();
        } else if (environment.acceptsProfiles(Profiles.of("prod"))) {
            logProdEnvironment();
        } else if (environment.acceptsProfiles(Profiles.of("test"))) {
            logTestEnvironment();
        }

        log.info("""
            ═══════════════════════════════════════════════════════════
                    APLICACIÓN LISTA PARA RECIBIR REQUESTS
            ═══════════════════════════════════════════════════════════
            """);
    }

    /**
     * Log específico para ambiente LOCAL
     */
    private void logLocalEnvironment() {
        log.warn("""
            
            ┌────────────────────────────────────────────────────────┐
            │      ENTORNO 'local' ACTIVO                            │
            ├────────────────────────────────────────────────────────┤
            │     Seguridad: JWT Keycloak y permisos por rol         │
            │  ️    Flyway: Ejecutándose en la aplicación            │
            │     R2DBC + JDBC: Ambos disponibles                    │
            │     Swagger UI: http://localhost:8081/swagger-ui.html  │
            │     Health: http://localhost:8081/actuator/health     │
            │                                                        │
            │     SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN     │
            └────────────────────────────────────────────────────────┘
            """);
    }

    private void logDockerEnvironment() {
        log.info("""
            
            ┌────────────────────────────────────────────────────────┐
            │   ENTORNO 'docker' ACTIVO                            │
            ├────────────────────────────────────────────────────────┤
            │     Seguridad: JWT con Keycloak Local                  │
            │       Flyway: Migración automática activada            │
            │     R2DBC: Pool optimizado para PostgreSQL             │
            │     Swagger UI: Accesible (sin auth)                   │
            │     ️  Health: Público para health checks               │
            └────────────────────────────────────────────────────────┘
            """);
    }


    private void logProdEnvironment() {
        log.info("""
            
            ┌────────────────────────────────────────────────────────┐
            │     ENTORNO 'prod' ACTIVO                              │
            ├────────────────────────────────────────────────────────┤
            │     Seguridad: MÁXIMA - JWT OIDC obligatorio           │
            │  ️      Flyway: Ejecución controlada                     │
            │     R2DBC: Pool optimizado para Alta Disponibilidad    │
            │     Swagger UI: NO ACCESIBLE                           │
            │       Health: Solo /actuator/health público            │
            │     Métricas: Prometheus habilitado                    │
            │       Circuit Breaker: Activo                          │
            └────────────────────────────────────────────────────────┘
            """);
    }


    private void logTestEnvironment() {
        log.info("""
            
            ┌────────────────────────────────────────────────────────┐
            │     ENTORNO 'test' ACTIVO                              │
            ├────────────────────────────────────────────────────────┤
            │     Seguridad: DESACTIVADA para tests                  │
            │       DB: Testcontainers PostgreSQL                    │
            │     R2DBC: Test configuration                          │
            └────────────────────────────────────────────────────────┘
            """);
    }
}
