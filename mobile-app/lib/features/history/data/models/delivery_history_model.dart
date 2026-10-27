import '../../domain/entities/delivery_history.dart';

class DeliveryHistoryModel extends DeliveryHistory {
  DeliveryHistoryModel({
    required super.orderId,
    required super.trackingNumber,
    required super.recipientName,
    required super.deliveryAddress,
    required super.status,
    super.deliveredAt,
  });

  factory DeliveryHistoryModel.fromJson(Map<String, dynamic> json) {
    return DeliveryHistoryModel(
      orderId: json['id'] as int,
      trackingNumber: json['trackingNumber'] as String,
      recipientName: json['recipientName'] as String,
      deliveryAddress: json['deliveryAddress'] as String,
      status: json['status'] as String,
      deliveredAt:
          json['deliveredAt']?.toString() ?? json['updatedAt']?.toString(),
    );
  }
}
