package com.ecoroute.backend.infrastructure.output.persistence;
import com.ecoroute.backend.domain.model.BusinessWorkflow.*;
import com.ecoroute.backend.domain.ports.out.BusinessWorkflowPort;
import com.ecoroute.backend.domain.exception.BusinessRuleException;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import java.time.OffsetDateTime;

@Component
@RequiredArgsConstructor
public class R2dbcBusinessWorkflowAdapter implements BusinessWorkflowPort {
    private final DatabaseClient db;
    public Mono<Confirmation> confirmation(Long id) {
        return db.sql("SELECT * FROM order_business_data WHERE order_id=:id").bind("id",id)
            .map((r,m) -> new Confirmation(id,r.get("recipient_ruc",String.class),Boolean.TRUE.equals(r.get("customer_accepted",Boolean.class)),
                Boolean.TRUE.equals(r.get("address_verified",Boolean.class)),Boolean.TRUE.equals(r.get("coverage_verified",Boolean.class)),
                r.get("agreement_note",String.class),r.get("confirmed_by",String.class),r.get("confirmed_at",OffsetDateTime.class))).one()
            .defaultIfEmpty(new Confirmation(id,null,false,false,false,"",null,null));
    }
    public Mono<Confirmation> saveConfirmation(Confirmation c) {
        var sql=db.sql("""
            INSERT INTO order_business_data(order_id,recipient_ruc,customer_accepted,address_verified,coverage_verified,agreement_note,confirmed_by,confirmed_at)
            VALUES(:id,:ruc,:accepted,:address,:coverage,:note,:actor,CASE WHEN :complete THEN NOW() ELSE NULL END)
            ON CONFLICT(order_id) DO UPDATE SET recipient_ruc=EXCLUDED.recipient_ruc,customer_accepted=EXCLUDED.customer_accepted,
            address_verified=EXCLUDED.address_verified,coverage_verified=EXCLUDED.coverage_verified,agreement_note=EXCLUDED.agreement_note,
            confirmed_by=EXCLUDED.confirmed_by,confirmed_at=EXCLUDED.confirmed_at
            """).bind("id",c.orderId()).bind("accepted",c.customerAccepted()).bind("address",c.addressVerified())
            .bind("coverage",c.coverageVerified()).bind("complete",c.complete()).bind("note",c.agreementNote()).bind("actor",c.confirmedBy());
        sql=c.recipientRuc()==null || c.recipientRuc().isBlank() ? sql.bindNull("ruc",String.class) : sql.bind("ruc",c.recipientRuc());
        return sql.fetch().rowsUpdated().then(confirmation(c.orderId()));
    }
    public Mono<Review> review(Long id) {
        return db.sql("SELECT * FROM route_dispatch_reviews WHERE route_id=:id").bind("id",id)
            .map((r,m) -> new Review(id,true,r.get("accepted_at")!=null,r.get("load_weight_kg",Double.class),r.get("approved_by",String.class),
                r.get("approved_at",OffsetDateTime.class),r.get("accepted_by",String.class),r.get("accepted_at",OffsetDateTime.class),r.get("note",String.class))).one()
            .defaultIfEmpty(new Review(id,false,false,null,null,null,null,null,null));
    }
    public Mono<Void> approve(Long id,Double weight,String actor,String note) {
        return db.sql("""
            INSERT INTO route_dispatch_reviews(route_id,load_weight_kg,approved_by,note) VALUES(:id,:weight,:actor,:note)
            ON CONFLICT(route_id) DO UPDATE SET load_weight_kg=EXCLUDED.load_weight_kg,approved_by=EXCLUDED.approved_by,
            approved_at=NOW(),accepted_by=NULL,accepted_at=NULL,note=EXCLUDED.note
            """).bind("id",id).bind("weight",weight).bind("actor",actor).bind("note",note).fetch().rowsUpdated().then();
    }
    public Mono<Void> accept(Long id,String actor) {
        return db.sql("UPDATE route_dispatch_reviews SET accepted_by=:actor,accepted_at=NOW() WHERE route_id=:id")
            .bind("actor",actor).bind("id",id).fetch().rowsUpdated().then();
    }
    public Mono<Void> invalidate(Long id) {
        if(id==null) return Mono.empty();
        return db.sql("DELETE FROM route_dispatch_reviews WHERE route_id=:id").bind("id",id).fetch().rowsUpdated().then();
    }
    public Mono<Void> requireConfirmed(Long id) {
        return confirmation(id).flatMap(c -> c.complete() ? Mono.empty() : Mono.error(new BusinessRuleException("Confirme dirección, cobertura y aceptación del cliente antes de asignar")));
    }
    public Mono<Void> requireDispatchReview(Long id) {
        return review(id).flatMap(r -> r.approved() && r.accepted() ? Mono.empty()
            : Mono.error(new BusinessRuleException("La salida requiere aprobación de jefatura y aceptación de la hoja por el conductor")));
    }
    public Mono<Void> audit(String process,String entity,Long id,String action,String actor,String details) {
        return db.sql("INSERT INTO business_audit_events(process_id,entity_type,entity_id,action,actor,details) VALUES(:process,:entity,:id,:action,:actor,:details)")
            .bind("process",process).bind("entity",entity).bind("id",id).bind("action",action).bind("actor",actor).bind("details",details).fetch().rowsUpdated().then();
    }
}
