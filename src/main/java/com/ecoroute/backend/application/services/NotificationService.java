package com.ecoroute.backend.application.services;

import com.ecoroute.backend.domain.model.Order;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import software.amazon.awssdk.services.sqs.SqsAsyncClient;
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;
import org.springframework.r2dbc.core.DatabaseClient;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {

    private final SqsAsyncClient sqsAsyncClient;
    private final ObjectMapper objectMapper;
    private final DatabaseClient db;

    @Value("${aws.sqs.queue-url}")
    private String queueUrl;

    public Mono<Void> sendDeliveryNotification(Order order) {
        return Mono.fromCallable(() -> objectMapper.writeValueAsString(order))
                .flatMap(payload -> db.sql("INSERT INTO delivery_outbox(order_id,payload) VALUES(:order,:payload) ON CONFLICT(order_id,event_type) DO NOTHING")
                        .bind("order",order.id()).bind("payload",payload).fetch().rowsUpdated()).then();
    }
}
