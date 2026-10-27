class RouteEntity {
  final int id;
  final int driverId;
  final int vehicleId;
  final String routeDate;
  final String status;
  final bool cached;

  RouteEntity({
    required this.id,
    required this.driverId,
    required this.vehicleId,
    required this.routeDate,
    required this.status,
    this.cached = false,
  });
}
