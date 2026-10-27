package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.BusinessOperations.*;
import com.ecoroute.backend.domain.ports.out.BusinessOperationsPort;
import io.r2dbc.spi.Row;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Component
@RequiredArgsConstructor
public class R2dbcBusinessOperationsAdapter implements BusinessOperationsPort {
    private final DatabaseClient db;
    private Incident readIncident(Row r) {
        return new Incident(r.get("id",Long.class),r.get("route_id",Long.class),r.get("order_id",Long.class),
            r.get("incident_type",String.class),r.get("severity",String.class),r.get("description",String.class),
            r.get("status",String.class),r.get("outcome",String.class),r.get("resolution_reason",String.class),
            r.get("next_route_id",Long.class),r.get("retry_order_id",Long.class),r.get("reported_by",String.class),
            r.get("resolved_by",String.class),r.get("reported_at",OffsetDateTime.class),r.get("resolved_at",OffsetDateTime.class));
    }
    private Improvement readAction(Row r) {
        return new Improvement(r.get("id",Long.class),r.get("title",String.class),r.get("cause",String.class),
            r.get("owner_name",String.class),r.get("due_date",LocalDate.class),r.get("metric_code",String.class),
            r.get("baseline_value",Double.class),r.get("target_value",Double.class),r.get("result_value",Double.class),
            r.get("status",String.class),r.get("note",String.class),r.get("created_by",String.class),r.get("verified_by",String.class));
    }
    private DatabaseClient.GenericExecuteSpec optional(DatabaseClient.GenericExecuteSpec sql,String key,Object value,Class<?> type) {
        return value==null ? sql.bindNull(key,type) : sql.bind(key,value);
    }
    public Flux<Incident> incidents() {
        return db.sql("SELECT * FROM incidents ORDER BY reported_at DESC,id DESC").map((r,m)->readIncident(r)).all();
    }
    public Mono<Incident> incident(Long id,boolean lock) {
        return db.sql("SELECT * FROM incidents WHERE id=:id"+(lock?" FOR UPDATE":"")).bind("id",id).map((r,m)->readIncident(r)).one();
    }
    public Mono<Incident> createIncident(Incident i) {
        var sql=db.sql("""
            INSERT INTO incidents(route_id,order_id,incident_type,severity,description,reported_by)
            VALUES(:route,:order,:type,:severity,:description,:actor)
            ON CONFLICT(order_id) WHERE order_id IS NOT NULL AND status='OPEN'
            DO UPDATE SET order_id=EXCLUDED.order_id RETURNING *
            """).bind("route",i.routeId()).bind("type",i.incidentType()).bind("severity",i.severity())
            .bind("description",i.description()).bind("actor",i.reportedBy());
        return optional(sql,"order",i.orderId(),Long.class).map((r,m)->readIncident(r)).one();
    }
    public Mono<Incident> resolve(Long id,String outcome,String reason,String actor,Long nextRouteId,Long retryOrderId) {
        var sql=db.sql("""
            UPDATE incidents SET status='RESOLVED',outcome=:outcome,resolution_reason=:reason,resolved_by=:actor,
            resolved_at=NOW(),next_route_id=:route,retry_order_id=:retry WHERE id=:id RETURNING *
            """).bind("id",id).bind("outcome",outcome).bind("reason",reason).bind("actor",actor);
        sql=optional(sql,"route",nextRouteId,Long.class);
        return optional(sql,"retry",retryOrderId,Long.class).map((r,m)->readIncident(r)).one();
    }
    public Mono<Void> linkAttempt(Long originalId,Long retryId,Long incidentId) {
        return db.sql("INSERT INTO order_attempts(original_order_id,retry_order_id,incident_id) VALUES(:original,:retry,:incident)")
            .bind("original",originalId).bind("retry",retryId).bind("incident",incidentId).fetch().rowsUpdated().then();
    }
    public Flux<Improvement> improvements() {
        return db.sql("SELECT * FROM improvement_actions ORDER BY id DESC").map((r,m)->readAction(r)).all();
    }
    public Mono<Improvement> improvement(Long id,boolean lock) {
        return db.sql("SELECT * FROM improvement_actions WHERE id=:id"+(lock?" FOR UPDATE":"")).bind("id",id).map((r,m)->readAction(r)).one();
    }
    public Mono<Improvement> createImprovement(Improvement i) {
        var sql=db.sql("""
            INSERT INTO improvement_actions(title,cause,owner_name,due_date,metric_code,baseline_value,target_value,created_by)
            VALUES(:title,:cause,:owner,:due,:metric,:baseline,:target,:actor) RETURNING *
            """).bind("title",i.title()).bind("cause",i.cause()).bind("owner",i.ownerName()).bind("due",i.dueDate())
            .bind("metric",i.metricCode()).bind("actor",i.createdBy());
        sql=optional(sql,"baseline",i.baselineValue(),Double.class);
        return optional(sql,"target",i.targetValue(),Double.class).map((r,m)->readAction(r)).one();
    }
    public Mono<Improvement> updateImprovement(Long id,String status,Double result,String note,String verifier) {
        var sql=db.sql("""
            UPDATE improvement_actions SET status=:status,result_value=:result,note=:note,verified_by=:verifier,
            updated_at=NOW() WHERE id=:id RETURNING *
            """).bind("id",id).bind("status",status).bind("note",note);
        sql=optional(sql,"result",result,Double.class);
        return optional(sql,"verifier",verifier,String.class).map((r,m)->readAction(r)).one();
    }
}
