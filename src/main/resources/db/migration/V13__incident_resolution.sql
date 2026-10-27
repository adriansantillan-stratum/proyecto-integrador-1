ALTER TABLE incidents ADD COLUMN next_route_id BIGINT REFERENCES routes(id);
ALTER TABLE incidents ADD COLUMN retry_order_id BIGINT REFERENCES orders(id);
-- Preserve legacy closures without attributing them to a fictitious current user.
UPDATE incidents SET status='RESOLVED',outcome='CLOSE_CASE',
    resolution_reason='Cierre histórico anterior a la auditoría de resolución',resolved_by='LEGACY_UNATTRIBUTED'
    WHERE resolved_at IS NOT NULL;
ALTER TABLE incidents ADD CONSTRAINT ck_incident_resolution CHECK (
    (status='OPEN' AND resolved_at IS NULL) OR
    (status='RESOLVED' AND outcome IN ('RETRY','REPLAN','CLOSE_FAILED','CLOSE_CASE')
        AND resolution_reason IS NOT NULL AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
);
ALTER TABLE improvement_actions ADD CONSTRAINT ck_improvement_status
    CHECK(status IN ('OPEN','IN_PROGRESS','VERIFIED','DISCARDED'));
ALTER TABLE improvement_actions ADD CONSTRAINT ck_improvement_verification
    CHECK(status<>'VERIFIED' OR (result_value IS NOT NULL AND verified_by IS NOT NULL AND note IS NOT NULL));
COMMENT ON COLUMN incidents.retry_order_id IS 'New linked attempt. Original terminal order and POD are never rewritten.';
