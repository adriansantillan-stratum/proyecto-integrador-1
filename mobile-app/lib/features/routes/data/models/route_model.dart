import '../../domain/entities/route.dart';

class RouteModel extends RouteEntity {
  RouteModel({
    required super.id,
    required super.driverId,
    required super.vehicleId,
    required super.routeDate,
    required super.status,
    super.cached,
  });

  factory RouteModel.fromJson(Map<String, dynamic> json,
      {bool cached = false}) {
    return RouteModel(
      id: json['id'] as int,
      cached: cached,
      driverId: json['driverId'] as int,
      vehicleId: json['vehicleId'] as int,
      routeDate: json['routeDate'] as String,
      status: json['status'] as String,
    );
  }
  Map<String, dynamic> toJson() => {
        'id': id,
        'driverId': driverId,
        'vehicleId': vehicleId,
        'routeDate': routeDate,
        'status': status
      };
}
