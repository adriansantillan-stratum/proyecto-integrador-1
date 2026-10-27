package com.ecoroute.backend.infrastructure.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.reactive.TransactionalOperator;
import reactor.core.publisher.Mono;
import software.amazon.awssdk.services.sqs.SqsAsyncClient;
import software.amazon.awssdk.services.sqs.model.*;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

/** Transactional outbox publisher and idempotent notification consumer. */
@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="ecoroute.events.enabled",havingValue="true",matchIfMissing=true)
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class DeliveryEventWorker {
    private final DatabaseClient db;
    private final SqsAsyncClient sqs;
    private final ObjectMapper mapper;
    private final TransactionalOperator transaction;
    private final AtomicBoolean publishing=new AtomicBoolean();
    private final AtomicBoolean consuming=new AtomicBoolean();
    @Value("${aws.sqs.queue-url}") private String queue;
    @org.springframework.context.annotation.Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean(TransactionalOperator.class)
    static TransactionalOperator transactionOperator(org.springframework.transaction.ReactiveTransactionManager manager) {
        return TransactionalOperator.create(manager);
    }

    @Scheduled(fixedDelay=3000,initialDelay=5000)
    public void publish() {
        if (!publishing.compareAndSet(false,true)) return;
        transaction.transactional(db.sql("""
            SELECT e.id,e.payload FROM delivery_outbox e
            WHERE e.sent_at IS NULL OR (e.sent_at<NOW()-INTERVAL '30 seconds' AND NOT EXISTS(
                SELECT 1 FROM notifications n WHERE n.order_id=e.order_id AND n.type='DELIVERY_CONFIRMED'))
            ORDER BY e.id LIMIT 20 FOR UPDATE OF e SKIP LOCKED
            """)
            .map((row,meta) -> new Event(row.get("id",Long.class),row.get("payload",String.class))).all()
            .concatMap(event -> Mono.fromCompletionStage(sqs.sendMessage(SendMessageRequest.builder().queueUrl(queue).messageBody(event.payload()).build()))
                .timeout(Duration.ofSeconds(5))
                .flatMap(response -> db.sql("UPDATE delivery_outbox SET sent_at=NOW(),attempts=attempts+1,last_error=NULL WHERE id=:id")
                    .bind("id",event.id()).fetch().rowsUpdated())
                .onErrorResume(error -> db.sql("UPDATE delivery_outbox SET attempts=attempts+1,last_error=:error WHERE id=:id")
                    .bind("id",event.id()).bind("error",error.getClass().getSimpleName()).fetch().rowsUpdated()))
            .then()).doFinally(signal -> publishing.set(false)).subscribe(null,error -> log.warn("Outbox no disponible: {}",error.getClass().getSimpleName()));
    }
    @Scheduled(fixedDelay=3000,initialDelay=7000)
    public void consume() {
        if (!consuming.compareAndSet(false,true)) return;
        Mono.fromCompletionStage(sqs.receiveMessage(ReceiveMessageRequest.builder().queueUrl(queue).maxNumberOfMessages(10).visibilityTimeout(30).build()))
            .timeout(Duration.ofSeconds(5)).flatMapMany(response -> reactor.core.publisher.Flux.fromIterable(response.messages()))
            .concatMap(message -> Mono.fromCallable(() -> mapper.readTree(message.body())).flatMap(json -> {
                long orderId=json.path("id").asLong();
                if(orderId<=0) return Mono.error(new IllegalArgumentException("Evento sin pedido"));
                return db.sql("""
                    INSERT INTO notifications(type,title,message,order_id)
                    VALUES('DELIVERY_CONFIRMED','Entrega confirmada',:message,:order)
                    ON CONFLICT(order_id,type) WHERE type='DELIVERY_CONFIRMED' DO NOTHING
                    """).bind("order",orderId).bind("message","Pedido "+json.path("trackingNumber").asText()+" entregado")
                    .fetch().rowsUpdated().then(Mono.fromCompletionStage(sqs.deleteMessage(DeleteMessageRequest.builder()
                        .queueUrl(queue).receiptHandle(message.receiptHandle()).build())));
            })).then().doFinally(signal -> consuming.set(false))
            .subscribe(null,error -> log.warn("Consumo SQS pendiente de reintento: {}",error.getClass().getSimpleName()));
    }
    private record Event(Long id,String payload) {}
}
