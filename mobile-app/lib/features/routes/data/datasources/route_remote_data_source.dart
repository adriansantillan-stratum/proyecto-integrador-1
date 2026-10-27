import 'package:dio/dio.dart';
import '../../../../core/cache/local_cache.dart';
import '../models/route_model.dart';
import '../models/route_path_model.dart';

abstract class RouteRemoteDataSource {
  Future<List<RouteModel>> getRoutes({required int driverId});
  Future<RoutePathModel> getRoutePath(int routeId,
      {double? fromLat, double? fromLng});
  Future<Map<String, dynamic>> review(int routeId);
  Future<void> accept(int routeId);
}

class RouteRemoteDataSourceImpl implements RouteRemoteDataSource {
  final Dio client;
  final LocalCache cache;
  RouteRemoteDataSourceImpl({required this.client, required this.cache});
  @override
  Future<List<RouteModel>> getRoutes({required int driverId}) async {
    final owner = cache.requireAccount();
    try {
      // Include outstanding active routes from earlier dates.
      final response = await client.get('/routes',
          options: Options(extra: {'account': owner}));
      final routes = (response.data as List)
          .map((j) => RouteModel.fromJson(j))
          .where((r) => r.driverId == driverId)
          .toList();
      if (cache.account != owner) throw StateError('La sesión cambió');
      await cache.write(
          owner, 'routes', routes.map((r) => r.toJson()).toList());
      return routes;
    } on DioException catch (e) {
      if (e.response != null) rethrow;
      final saved = await cache.read(owner, 'routes') as List?;
      if (saved == null || cache.account != owner) rethrow;
      return saved
          .map((j) =>
              RouteModel.fromJson(Map<String, dynamic>.from(j), cached: true))
          .toList();
    }
  }

  @override
  Future<RoutePathModel> getRoutePath(int routeId,
      {double? fromLat, double? fromLng}) async {
    final response =
        await client.get('/routes/$routeId/path', queryParameters: {
      if (fromLat != null) 'fromLat': fromLat,
      if (fromLng != null) 'fromLng': fromLng,
    });
    return RoutePathModel.fromJson(Map<String, dynamic>.from(response.data));
  }

  @override
  Future<Map<String, dynamic>> review(int routeId) async {
    final response = await client.get('/routes/$routeId/review');
    return Map<String, dynamic>.from(response.data);
  }

  @override
  Future<void> accept(int routeId) async {
    await client.post('/routes/$routeId/acceptance', data: {});
  }
}
