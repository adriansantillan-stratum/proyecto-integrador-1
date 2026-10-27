import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:ecoroute_driver_app/core/cache/local_cache.dart';
import 'package:ecoroute_driver_app/core/utils/path_throttle.dart';
import 'package:ecoroute_driver_app/core/utils/valid_coordinates.dart';
import 'package:ecoroute_driver_app/features/gps/data/datasources/gps_sensor_data_source.dart';
import 'package:ecoroute_driver_app/features/gps/data/repositories/gps_repository_impl.dart';
import 'package:ecoroute_driver_app/features/gps/presentation/bloc/gps_bloc.dart';
import 'package:ecoroute_driver_app/features/history/data/datasources/history_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/history/data/repositories/history_repository_impl.dart';
import 'package:ecoroute_driver_app/features/routes/data/datasources/route_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/routes/data/repositories/route_repository_impl.dart';
import 'package:ecoroute_driver_app/features/orders/data/repositories/order_repository_impl.dart';
import 'package:ecoroute_driver_app/features/orders/data/datasources/order_remote_data_source.dart';
import 'package:ecoroute_driver_app/core/sync/proof_sync.dart';
import 'fakes.dart';

Position position({double lat = -12.04, double lng = -77.03, DateTime? at}) =>
    Position(
        latitude: lat,
        longitude: lng,
        timestamp: at ?? DateTime.now(),
        accuracy: 5,
        altitude: 0,
        altitudeAccuracy: 5,
        heading: 20,
        headingAccuracy: 5,
        speed: 1,
        speedAccuracy: 1);

class Sensor implements GpsSensorDataSource {
  final positions = StreamController<Position>.broadcast();
  bool granted = true;
  @override
  Future<bool> checkAndRequestPermissions() async => granted;
  @override
  Future<Position> getCurrentLocation() async => position();
  @override
  Stream<Position> getLocationStream() => positions.stream;
}

Map<String, dynamic> route(int id, int driver, int vehicle) => {
      'id': id,
      'driverId': driver,
      'vehicleId': vehicle,
      'routeDate': '2026-10-19',
      'status': 'IN_PROGRESS'
    };
Map<String, dynamic> order(int id, int routeId,
        {String status = 'DELIVERED', DateTime? at}) =>
    {
      'id': id,
      'routeId': routeId,
      'trackingNumber': 'T$id',
      'status': status,
      'recipientName': 'R',
      'deliveryAddress': 'A',
      if (at != null) 'updatedAt': at.toIso8601String()
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
      'GPS rejects missing route, zero, old position; uses selected real vehicle',
      () async {
    final sent = <Map<String, dynamic>>[];
    final sensor = Sensor();
    final repo = GpsRepositoryImpl(
        sensorDataSource: sensor,
        apiClient: fakeDio((o) {
          sent.add(Map<String, dynamic>.from(o.data));
          return {};
        }));
    expect((await repo.sendLocationToBackend(position())).isLeft(), isTrue);
    repo.setRoute(driverId: 7, vehicleId: 42, active: true);
    expect(
        (await repo.sendLocationToBackend(position(lat: 0))).isLeft(), isTrue);
    expect(
        (await repo.sendLocationToBackend(position(
                at: DateTime.now().subtract(const Duration(hours: 1)))))
            .isLeft(),
        isTrue);
    expect((await repo.sendLocationToBackend(position())).isRight(), isTrue);
    expect(sent.single['vehicleId'], 42);
    expect(sent.single['driverId'], 7);
    repo.setRoute(driverId: 7, vehicleId: 99, active: true);
    await repo.sendLocationToBackend(position());
    expect(sent.last['vehicleId'], 99);
    repo.clearRoute();
    expect((await repo.sendLocationToBackend(position())).isLeft(), isTrue);
    await sensor.positions.close();
  });
  for (final routeFirst in [true, false]) {
    test(
        'Initial GPS ping when routeFirst=$routeFirst and position become available',
        () async {
      final sensor = Sensor();
      final sent = Completer<Map<String, dynamic>>();
      final repo = GpsRepositoryImpl(
          sensorDataSource: sensor,
          apiClient: fakeDio((o) {
            if (!sent.isCompleted) {
              sent.complete(Map<String, dynamic>.from(o.data));
            }
            return {};
          }));
      final bloc = GpsBloc(gpsRepository: repo);
      if (routeFirst) {
        bloc.add(const RouteTrackingChanged(7, 42, true));
        bloc.add(OnLocationUpdate(position()));
      } else {
        final seen = bloc.stream.firstWhere((s) => s.lastKnownPosition != null);
        bloc.add(OnLocationUpdate(position()));
        await seen;
        bloc.add(const RouteTrackingChanged(7, 42, true));
      }
      expect((await sent.future)['vehicleId'], 42);
      await bloc.close();
      await sensor.positions.close();
    });
  }
  test('Permission denial remains visible and GPS never accepts 0 or NaN',
      () async {
    final sensor = Sensor()..granted = false;
    final repo = GpsRepositoryImpl(
        sensorDataSource: sensor, apiClient: fakeDio((o) => {}));
    final bloc = GpsBloc(gpsRepository: repo);
    final error = bloc.stream.firstWhere((s) => s.error.isNotEmpty);
    bloc.add(AskGpsPermissions());
    expect((await error).isAllGranted, isFalse);
    expect(validCoordinates(0, -77), isFalse);
    expect(validCoordinates(-12, 0), isFalse);
    expect(validCoordinates(double.nan, -77), isFalse);
    expect(validCoordinates(91, -77), isFalse);
    await bloc.close();
    await sensor.positions.close();
  });
  test('Coordinate-aware path throttle keeps latest moved position eligible',
      () {
    final throttle = PathThrottle();
    final now = DateTime.now();
    expect(throttle.allow('route1:1-ASSIGNED', -12, -77, now), isTrue);
    expect(
        throttle.allow('route1:1-ASSIGNED', -12.01, -77,
            now.add(const Duration(seconds: 1))),
        isFalse);
    expect(
        throttle.allow('route1:1-ASSIGNED', -12.01, -77,
            now.add(const Duration(seconds: 16))),
        isTrue);
    expect(
        throttle.allow('route1:1-ASSIGNED', -12.01, -77,
            now.add(const Duration(seconds: 40))),
        isFalse);
    throttle.failed();
    expect(
        throttle.allow('route1:1-ASSIGNED', -12.01, -77,
            now.add(const Duration(seconds: 17))),
        isFalse);
  });
  test(
      'All own routes survive filtering; review/acceptance/path honor endpoints',
      () async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'a';
    final calls = <String>[];
    final source = RouteRemoteDataSourceImpl(
        cache: cache,
        client: fakeDio((o) {
          calls.add('${o.method} ${o.path}');
          if (o.path == '/routes') {
            return [route(1, 7, 42), route(2, 7, 99), route(3, 8, 88)];
          }
          if (o.path.endsWith('/review')) {
            return {'approved': true, 'accepted': false, 'loadWeightKg': 15};
          }
          if (o.path.endsWith('/path')) {
            expect(o.queryParameters['fromLat'], -12.1);
            return {
              'source': 'haversine',
              'orderedOrderIds': [11, 12],
              'durationMin': 0
            };
          }
          expect(o.data, isEmpty);
          return {};
        }));
    final repo = RouteRepositoryImpl(remoteDataSource: source);
    final result = await repo.getDriverRoutes(7);
    result.fold((f) => fail(f.message),
        (routes) => expect(routes.map((r) => r.id), [1, 2]));
    expect((await source.review(2))['approved'], isTrue);
    await source.accept(2);
    final path = await source.getRoutePath(2, fromLat: -12.1, fromLng: -77.1);
    expect(path.source, 'haversine');
    expect(path.orderedOrderIds, [11, 12]);
    expect(
        calls,
        containsAll([
          'GET /routes/2/review',
          'POST /routes/2/acceptance',
          'GET /routes/2/path'
        ]));
  });
  test(
      'History keeps own terminal orders within period; failure is not empty success',
      () async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'account-a';
    final local = MemorySession(user());
    var broken = false;
    final now = DateTime.now();
    final source = HistoryRemoteDataSourceImpl(
        cache: cache,
        local: local,
        client: fakeDio((o) {
          if (broken) httpError(o, 503);
          if (o.path == '/routes') return [route(1, 7, 42), route(2, 8, 99)];
          return [
            order(1, 1, at: now),
            order(2, 2, at: now),
            order(3, 1, at: now.subtract(const Duration(days: 40))),
            order(4, 1, status: 'ASSIGNED', at: now),
            order(5, 1, status: 'RETURNED', at: now)
          ];
        }));
    final repo = HistoryRepositoryImpl(remoteDataSource: source);
    final result = await repo.getDeliveryHistory(days: 7);
    result.fold((f) => fail(f.message),
        (history) => expect(history.map((h) => h.orderId).toSet(), {1, 5}));
    broken = true;
    expect((await repo.getDeliveryHistory()).isLeft(), isTrue);
  });
  test('Own missing timestamp raises visible history failure', () async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'account-a';
    final source = HistoryRemoteDataSourceImpl(
        cache: cache,
        local: MemorySession(user()),
        client: fakeDio(
            (o) => o.path == '/routes' ? [route(1, 7, 42)] : [order(1, 1)]));
    expect(
        (await HistoryRepositoryImpl(remoteDataSource: source)
                .getDeliveryHistory())
            .isLeft(),
        isTrue);
  });
  test(
      'Orders cached per account only on transport failure; HTTP errors remain failures',
      () async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'a';
    var mode = 'online';
    final dio = fakeDio((o) {
      if (mode == 'http') httpError(o, 403);
      if (mode == 'offline') throw StateError('Offline');
      return [order(2, 1, status: 'ASSIGNED')];
    });
    final sync = ProofSync(cache: cache, client: dio);
    final repo = OrderRepositoryImpl(
        remoteDataSource: OrderRemoteDataSourceImpl(client: dio),
        cache: cache,
        sync: sync);
    expect((await repo.getOrdersByRoute(1)).isRight(), isTrue);
    mode = 'offline';
    (await repo.getOrdersByRoute(1)).fold((f) => fail(f.message),
        (orders) => expect(orders.single.cached, isTrue));
    cache.account = 'b';
    expect((await repo.getOrdersByRoute(1)).isLeft(), isTrue);
    cache.account = 'a';
    mode = 'http';
    expect((await repo.getOrdersByRoute(1)).isLeft(), isTrue);
    sync.dispose();
  });
}
