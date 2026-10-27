// Opt-in host test. Never starts a device or installs an APK.
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ecoroute_driver_app/core/cache/local_cache.dart';
import 'package:ecoroute_driver_app/core/network/api_config.dart';
import 'package:ecoroute_driver_app/core/network/auth_interceptor.dart';
import 'package:ecoroute_driver_app/core/network/session_refresh.dart';
import 'package:ecoroute_driver_app/features/auth/data/datasources/auth_local_data_source.dart';
import 'package:ecoroute_driver_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/auth/data/models/user_model.dart';
import 'package:ecoroute_driver_app/features/orders/data/datasources/order_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/routes/data/datasources/route_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/routes/data/models/route_model.dart';
import 'package:ecoroute_driver_app/features/orders/data/models/order_model.dart';
import 'package:ecoroute_driver_app/features/history/data/datasources/history_remote_data_source.dart';

void main() {
  const enabled = bool.fromEnvironment('RUN_BACKEND_CONTRACT');
  TestWidgetsFlutterBinding.ensureInitialized();
  group('Live mobile/backend contract (no operational data mutations)', () {
    late Dio api;
    late Dio identity;
    late AuthRemoteDataSourceImpl auth;
    late AuthLocalDataSourceImpl local;
    late SessionRefresh refresh;
    late UserModel account;
    late RouteRemoteDataSourceImpl source;
    List<RouteModel> routes = [];
    List<OrderModel> orders = [];
    bool revoked = false;
    setUpAll(() async {
      // flutter_test's normal fake HttpClient is replaced only for this opt-in suite.
      HttpOverrides.global = null;
      FlutterSecureStorage.setMockInitialValues({});
      identity = Dio(BaseOptions(
          baseUrl: ApiConfig.identityUrl,
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 30)));
      api = Dio(BaseOptions(
          baseUrl: ApiConfig.backendUrl,
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 30)));
      local =
          AuthLocalDataSourceImpl(secureStorage: const FlutterSecureStorage());
      refresh = SessionRefresh(client: identity, local: local);
      api.interceptors.add(AuthInterceptor(
          localDataSource: local,
          refresh: refresh,
          client: api,
          onExpired: () {}));
      auth = AuthRemoteDataSourceImpl(client: identity, apiClient: api);
      final username = Platform.environment['ECOROUTE_TEST_USER'];
      final password = Platform.environment['ECOROUTE_TEST_PASSWORD'];
      if (username == null || password == null) {
        throw StateError(
            'Configure las credenciales de prueba en variables de entorno');
      }
      account = await auth.login(username, password);
      await local.cacheUser(account);
      final cache = LocalCache(storage: const FlutterSecureStorage())
        ..account = account.subject;
      source = RouteRemoteDataSourceImpl(client: api, cache: cache);
    });
    tearDownAll(() async {
      // Revoke only the test session, never operational records.
      if (!revoked) await auth.logout((await local.getLastUser()).refreshToken);
      api.close();
      identity.close();
    });
    test('Session links numeric driver to UUID subject and reads exp TTL', () {
      expect(int.parse(account.id), greaterThan(0));
      expect(
          RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
              .hasMatch(account.subject),
          isTrue);
      expect(account.roles, contains('ROLE_DRIVER'));
      final seconds = SessionRefresh.expiry(account.token)!
          .difference(DateTime.now())
          .inSeconds;
      expect(seconds, inInclusiveRange(1, 610));
    });
    test('Reads all own routes and route-filtered orders using mobile models',
        () async {
      routes = await source.getRoutes(driverId: int.parse(account.id));
      expect(routes.every((r) => '${r.driverId}' == account.id), isTrue);
      final orderSource = OrderRemoteDataSourceImpl(client: api);
      for (final r in routes) {
        final found = await orderSource.getOrdersByRoute(r.id);
        expect(found.every((o) => o.routeId == r.id), isTrue);
        orders.addAll(found);
      }
    });
    test(
        'Reads review approved/accepted and metadata without accepting real route',
        () async {
      if (routes.isEmpty) {
        markTestSkipped('La cuenta no tiene rutas para consultar review');
        return;
      }
      final review = await source.review(routes.first.id);
      expect(review['approved'], isA<bool>());
      expect(review['accepted'], isA<bool>());
      expect(
          review.keys,
          containsAll([
            'routeId',
            'loadWeightKg',
            'approvedBy',
            'approvedAt',
            'acceptedBy',
            'acceptedAt',
            'note'
          ]));
    });
    test('Reads route path from two changing origins and recognizes fallback',
        () async {
      if (routes.isEmpty) {
        markTestSkipped('La cuenta no tiene rutas para consultar path');
        return;
      }
      for (final lat in [-12.0464, -12.0454]) {
        final path = await source.getRoutePath(routes.first.id,
            fromLat: lat, fromLng: -77.0428);
        expect(['osrm', 'haversine'], contains(path.source));
        expect(path.distanceKm.isFinite, isTrue);
        expect(path.durationMin.isFinite, isTrue);
      }
    });
    test('Invalid POD rejected before creating proof for nonexistent order',
        () async {
      await expectLater(
          api.post('/delivery-proofs', data: {
            'orderId': -1,
            'receiverName': 'Contract test',
            'receiverDni': '12345678',
            'latitude': 0,
            'longitude': 0,
          }),
          throwsA(isA<DioException>()
              .having((e) => e.response?.statusCode, 'HTTP status', 400)));
    });
    test('History source loads own terminal operation within selected period', () async {
      final cache = LocalCache(storage: const FlutterSecureStorage())..account = account.subject;
      final history = await HistoryRemoteDataSourceImpl(client: api, cache: cache, local: local)
          .getDeliveryHistory(days: 30);
      final own = orders.map((o) => o.id).toSet();
      expect(history.every((h) => own.contains(h.orderId)), isTrue);
      expect(history.every((h) => ['DELIVERED', 'FAILED', 'RETURNED'].contains(h.status)), isTrue);
    });
    test(
        'Refresh against real Keycloak rotates session and preserves driver identity',
        () async {
      final updated = await refresh.refresh((await local.getLastUser()).token);
      expect(updated.refreshToken, isNotEmpty);
      expect(updated.subject, account.subject);
      expect(updated.id, account.id);
      final me = await api.get('/session/me');
      expect('${me.data['driverId']}', account.id);
      expect(me.data['subject'], account.subject);
    });
    test('Keycloak logout rejects subsequent refresh of the test session',
        () async {
      final last = await local.getLastUser();
      await auth.logout(last.refreshToken);
      revoked = true;
      await expectLater(
          identity.post('${ApiConfig.oidcPath}/token',
              data: {
                'client_id': ApiConfig.clientId,
                'grant_type': 'refresh_token',
                'refresh_token': last.refreshToken,
              },
              options: Options(contentType: Headers.formUrlEncodedContentType)),
          throwsA(isA<DioException>()
              .having((e) => e.response?.statusCode, 'HTTP status', 400)));
    });
  },
      skip: !enabled
          ? 'Opt-in: RUN_BACKEND_CONTRACT=true, localhost API/Keycloak y credenciales de entorno'
          : false);
}
