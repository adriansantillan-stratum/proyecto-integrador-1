class OrderEntity {
  final int id;
  final String trackingNumber;
  final int routeId;
  final String status;
  final String recipientName;
  final String deliveryAddress;
  final double? latitude;
  final double? longitude;
  final bool cached;
  bool get terminal =>
      const ['DELIVERED', 'FAILED', 'RETURNED'].contains(status);

  OrderEntity({
    required this.id,
    required this.trackingNumber,
    required this.routeId,
    required this.status,
    required this.recipientName,
    required this.deliveryAddress,
    this.latitude,
    this.longitude,
    this.cached = false,
  });
}
