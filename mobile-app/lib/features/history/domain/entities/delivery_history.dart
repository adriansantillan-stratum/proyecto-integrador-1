class DeliveryHistory {
  final int orderId;
  final String trackingNumber;
  final String recipientName;
  final String deliveryAddress;
  final String status;
  final String? deliveredAt;

  DeliveryHistory({
    required this.orderId,
    required this.trackingNumber,
    required this.recipientName,
    required this.deliveryAddress,
    required this.status,
    this.deliveredAt,
  });
}
