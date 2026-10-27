import '../../domain/entities/order.dart';

class OrderModel extends OrderEntity {
  OrderModel({
    required super.id,
    required super.trackingNumber,
    required super.routeId,
    required super.status,
    required super.recipientName,
    required super.deliveryAddress,
    super.latitude,
    super.longitude,
    super.cached,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json,
      {bool cached = false}) {
    return OrderModel(
      id: json['id'] as int,
      cached: cached,
      trackingNumber: json['trackingNumber'] as String,
      routeId: json['routeId'] as int,
      status: json['status'] as String,
      recipientName: json['recipientName'] as String,
      deliveryAddress: json['deliveryAddress'] as String,
      latitude: json['latitude'] != null
          ? double.parse(json['latitude'].toString())
          : null,
      longitude: json['longitude'] != null
          ? double.parse(json['longitude'].toString())
          : null,
    );
  }
  Map<String, dynamic> toJson() => {
        'id': id,
        'trackingNumber': trackingNumber,
        'routeId': routeId,
        'status': status,
        'recipientName': recipientName,
        'deliveryAddress': deliveryAddress,
        'latitude': latitude,
        'longitude': longitude,
      };
}
