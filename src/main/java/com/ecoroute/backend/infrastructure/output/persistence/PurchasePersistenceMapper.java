package com.ecoroute.backend.infrastructure.output.persistence;

import com.ecoroute.backend.domain.model.Purchase;

public class PurchasePersistenceMapper {

    public static Purchase toDomain(PurchaseEntity entity) {
        return new Purchase(
                entity.getId(),
                entity.getDescription(),
                entity.getSupplier(),
                entity.getAmount(),
                entity.getStatus(),
                entity.getCategory(),
                entity.getNotes(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public static PurchaseEntity toEntity(Purchase domain) {
        PurchaseEntity entity = new PurchaseEntity();
        entity.setId(domain.id());
        entity.setDescription(domain.description());
        entity.setSupplier(domain.supplier());
        entity.setAmount(domain.amount());
        entity.setStatus(domain.status());
        entity.setCategory(domain.category());
        entity.setNotes(domain.notes());
        entity.setCreatedAt(domain.createdAt());
        entity.setUpdatedAt(domain.updatedAt());
        entity.setNew(domain.id() == null);
        return entity;
    }
}
