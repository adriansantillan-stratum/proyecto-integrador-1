package com.ecoroute.backend.infrastructure.output.persistence;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.domain.Persistable;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.OffsetDateTime;

@Data
@Table("delivery_proofs")
public class DeliveryProofEntity implements Persistable<Long> {
    @Id
    @Column("id")
    private Long id;

    @Column("order_id")
    private Long orderId;

    @Column("image_url")
    private String imageUrl;

    @Column("signature_data_url")
    private String signatureDataUrl;

    @Column("receiver_name")
    private String receiverName;

    @Column("receiver_dni")
    private String receiverDni;

    @Column("verified_at")
    private OffsetDateTime verifiedAt;

    @Column("latitude")
    private Double latitude;

    @Column("longitude")
    private Double longitude;

    @Transient
    private boolean isNew;

    @Override
    public boolean isNew() {
        return this.isNew || id == null;
    }
}
