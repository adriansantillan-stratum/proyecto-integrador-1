-- Camino real por calles (WS3): geometría del recorrido, duración estimada
-- y orden de visita de cada pedido calculados por el motor de ruteo (OSRM).

ALTER TABLE routes ADD COLUMN IF NOT EXISTS geometry TEXT;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS total_duration_min DOUBLE PRECISION;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stop_sequence INT;
