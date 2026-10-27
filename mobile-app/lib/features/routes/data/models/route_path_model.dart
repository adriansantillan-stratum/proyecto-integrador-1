/// Camino calculado por el backend (GET /routes/{id}/path).
class RoutePathModel {
  /// Geometría por calles (polyline5); null si el backend usó el fallback.
  final String? polyline;

  /// Ids de pedidos en orden óptimo de visita.
  final List<int> orderedOrderIds;

  final double distanceKm;
  final double durationMin;

  /// "osrm" (calles reales) o "haversine" (fallback).
  final String source;

  RoutePathModel({
    required this.polyline,
    required this.orderedOrderIds,
    required this.distanceKm,
    required this.durationMin,
    required this.source,
  });

  factory RoutePathModel.fromJson(Map<String, dynamic> json) {
    return RoutePathModel(
      polyline: json['polyline'] as String?,
      orderedOrderIds: (json['orderedOrderIds'] as List<dynamic>? ?? [])
          .map((e) => (e as num).toInt())
          .toList(),
      distanceKm: (json['distanceKm'] as num? ?? 0).toDouble(),
      durationMin: (json['durationMin'] as num? ?? 0).toDouble(),
      source: json['source'] as String? ?? 'haversine',
    );
  }
}
