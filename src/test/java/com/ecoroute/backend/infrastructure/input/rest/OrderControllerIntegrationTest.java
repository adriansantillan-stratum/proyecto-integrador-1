package com.ecoroute.backend.infrastructure.input.rest;

import static org.springframework.security.test.web.reactive.server.SecurityMockServerConfigurers.csrf;

import com.ecoroute.backend.domain.model.Order;
import com.ecoroute.backend.domain.model.OrderStatus;
import com.ecoroute.backend.infrastructure.input.rest.CreateOrderRequest;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker=true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OrderControllerIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        "postgres:14-alpine"
    ).withReuse(true);

    @BeforeAll
    static void beforeAll() {
        // Soluciona problemas de Ryuk en algunos entornos Docker Windows/Mac
        System.setProperty("testcontainers.ryuk.container.privileged", "true");
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("ecoroute.events.enabled",() -> "false");
        registry.add("ecoroute.rate-limit.enabled",() -> "false");
        // Configuración R2DBC (Reactiva) para la App
        registry.add("spring.r2dbc.url", () ->
            String.format(
                "r2dbc:postgresql://%s:%d/%s",
                postgres.getHost(),
                postgres.getFirstMappedPort(),
                postgres.getDatabaseName()
            )
        );
        registry.add("spring.r2dbc.username", postgres::getUsername);
        registry.add("spring.r2dbc.password", postgres::getPassword);

        // Configuración JDBC (Bloqueante) para Flyway (Migraciones)
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);
        registry.add("spring.flyway.driver-class-name", () ->
            "org.postgresql.Driver"
        );
    }

    // MOCK CLAVE: Evita que Spring intente conectarse a https://example.com
    @MockBean
    private ReactiveJwtDecoder jwtDecoder;

    @Autowired
    private WebTestClient webTestClient;

    @Test
    @WithMockUser(roles="ADMIN")
    void createOrder() {
        CreateOrderRequest request = new CreateOrderRequest(
            "tracking-xyz",
            "REF-123",
            null,
            OrderStatus.PENDING,
            "Juan Perez",
            "999888777",
            "juan@example.com",
            "Av. Siempre Viva 123",
            "Lima",
            "Miraflores",
            -12.122,
            -77.028,
            1,
            null,
            null
        );

        webTestClient
            .post()
            .uri("/orders")
            .bodyValue(request)
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody(Order.class)
            .value(order -> {
                assert order.id() != null;
                assert order.trackingNumber().equals("tracking-xyz");
                assert order.status() == OrderStatus.PENDING;
            });
    }
}
