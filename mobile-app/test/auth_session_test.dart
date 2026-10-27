import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ecoroute_driver_app/core/cache/local_cache.dart';
import 'package:ecoroute_driver_app/core/network/auth_interceptor.dart';
import 'package:ecoroute_driver_app/core/network/session_refresh.dart';
import 'package:ecoroute_driver_app/core/sync/proof_sync.dart';
import 'package:ecoroute_driver_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/auth/data/models/user_model.dart';
import 'package:ecoroute_driver_app/features/auth/data/repositories/auth_repository_impl.dart';
import 'fakes.dart';

String jwt(DateTime expires) =>
    'eyJhbGciOiJub25lIn0.${base64Url.encode(utf8.encode(jsonEncode({
              'exp': expires.millisecondsSinceEpoch ~/ 1000,
            }))).replaceAll('=', '')}.signature';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test('UserModel persists refresh token and authoritative subject', () {
    final restored = UserModel.fromJson(user().toJson());
    expect(restored.refreshToken, 'refresh-account-a');
    expect(restored.subject, 'account-a');
    expect(restored.id, '7');
  });
  test('Login uses /session/me GrantedAuthority and rejects unlinked driver',
      () async {
    var linked = true;
    final auth =
        fakeDio((o) => {'access_token': 'access', 'refresh_token': 'refresh'});
    final api = fakeDio((o) {
      expect(o.path, '/session/me');
      expect(o.headers['Authorization'], 'Bearer access');
      return {
        'subject': 'external-id',
        if (linked) 'driverId': 81,
        'roles': [
          {'authority': 'ROLE_DRIVER'}
        ]
      };
    });
    final source = AuthRemoteDataSourceImpl(client: auth, apiClient: api);
    final account = await source.login('demo', 'password');
    expect(account.id, '81');
    expect(account.subject, 'external-id');
    linked = false;
    await expectLater(source.login('demo', 'password'), throwsException);
  });
  test('Concurrent rejected tokens share one refresh and rotate refresh token',
      () async {
    final local = MemorySession(user());
    var calls = 0;
    final gate = Completer<void>();
    final refresh = SessionRefresh(
        local: local,
        client: fakeDio((o) async {
          calls++;
          expect(o.data['grant_type'], 'refresh_token');
          expect(o.data['refresh_token'], 'refresh-account-a');
          await gate.future;
          return {'access_token': 'new', 'refresh_token': 'rotated'};
        }));
    final first = refresh.refresh('old');
    final second = refresh.refresh('old');
    await Future<void>.delayed(Duration.zero);
    gate.complete();
    final accounts = await Future.wait([first, second]);
    expect(calls, 1);
    expect(accounts.every((a) => a.token == 'new'), isTrue);
    expect((await local.getLastUser()).refreshToken, 'rotated');
    await refresh.refresh('old');
    expect(calls, 1);
  });
  for (final ttl in [600, 28800]) {
    test('exp claim determines refresh for $ttl second lifetime', () async {
      var calls = 0;
      final future = DateTime.now().toUtc().add(Duration(seconds: ttl));
      final local = MemorySession(user(token: jwt(future)));
      final refresh = SessionRefresh(
          local: local,
          client: fakeDio((o) {
            calls++;
            return {'access_token': jwt(future)};
          }));
      await refresh.ensureFresh();
      expect(calls, 0);
      local.value =
          user(token: jwt(DateTime.now().subtract(const Duration(seconds: 1))));
      await refresh.ensureFresh();
      expect(calls, 1);
      expect(SessionRefresh.expiry(jwt(future))!.difference(future).abs(),
          lessThan(const Duration(seconds: 1)));
    });
  }
  test('Logout during refresh cannot resurrect cached session', () async {
    final local = MemorySession(user());
    final gate = Completer<void>();
    final entered = Completer<void>();
    final refresh = SessionRefresh(
        local: local,
        client: fakeDio((o) async {
          entered.complete();
          await gate.future;
          return {'access_token': 'new'};
        }));
    final inflight = refresh.refresh('old');
    final rejected = expectLater(inflight, throwsA(anything));
    await entered.future;
    refresh.invalidate();
    await local.clearCache();
    gate.complete();
    await rejected;
    expect(local.value, isNull);
  });
  test(
      'Interceptor retries one request after 401 and blocks cross-account requests',
      () async {
    final local = MemorySession(user());
    var refreshCalls = 0;
    final refresh = SessionRefresh(
        local: local,
        client: fakeDio((o) {
          refreshCalls++;
          return {'access_token': 'new'};
        }));
    final api = Dio(BaseOptions(baseUrl: 'http://test.invalid'));
    var expired = 0;
    api.interceptors.add(AuthInterceptor(
        localDataSource: local,
        refresh: refresh,
        client: api,
        onExpired: () => expired++));
    var requests = 0;
    api.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      requests++;
      if (o.headers['Authorization'] == 'Bearer old') {
        h.reject(
            DioException(
                requestOptions: o,
                response: Response(requestOptions: o, statusCode: 401)),
            true);
      } else {
        h.resolve(Response(requestOptions: o, statusCode: 200, data: {}));
      }
    }));
    await api.get('/orders');
    expect(requests, 2);
    expect(refreshCalls, 1);
    expect(expired, 0);
    await expectLater(
        api.get('/orders', options: Options(extra: {'account': 'another'})),
        throwsA(isA<DioException>()));
    expect(requests, 2);
  });
  test(
      'Logout clears local session, preserves account queue, calls Keycloak logout',
      () async {
    final local = MemorySession(user());
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'account-a';
    await cache.enqueue('account-a', {'orderId': 8});
    var revoked = false;
    final auth = fakeDio((o) {
      expect(o.path, endsWith('/logout'));
      expect(o.data['refresh_token'], 'refresh-account-a');
      revoked = true;
      return {};
    });
    final api = fakeDio((o) => {});
    final sync = ProofSync(cache: cache, client: api);
    final repo = AuthRepositoryImpl(
        remoteDataSource:
            AuthRemoteDataSourceImpl(client: auth, apiClient: api),
        localDataSource: local,
        cache: cache,
        sync: sync,
        refresh: SessionRefresh(client: auth, local: local));
    expect((await repo.logout()).isRight(), isTrue);
    expect(revoked, isTrue);
    expect(local.value, isNull);
    expect(cache.account, isNull);
    expect((await cache.pending('account-a')).single['orderId'], 8);
    sync.dispose();
  });
}
