CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    tracking_number VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    driver_id BIGINT
);