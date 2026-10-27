-- Only used when aws.s3.local-durable-backup=true (local Docker profile).
-- Keeps test evidence durable even if the S3 emulator loses its in-memory catalogue.
CREATE TABLE local_evidence_backups (
    object_key VARCHAR(300) PRIMARY KEY,
    content BYTEA NOT NULL,
    media_type VARCHAR(40) NOT NULL CHECK(media_type IN ('image/png','image/jpeg')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK(octet_length(content)<=10485760)
);
COMMENT ON TABLE local_evidence_backups IS 'Local emulator recovery only. Not enabled for production. Contains original evidence bytes, not generated replacements.';
