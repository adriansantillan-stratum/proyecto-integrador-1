import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ecoroute_driver_app/core/network/auth_interceptor.dart';
import 'package:ecoroute_driver_app/core/network/session_refresh.dart';
import 'fakes.dart';
import 'session_navigation_support.dart';

void main() {
  for (final status in [400, 403, 409, 422, 500]) {
    test('API $status without refresh keeps session', () async {
      final local = MemorySession(user());
      var expired = 0;
      var refreshCalls = 0;
      final identity = fakeDio((_) {
        refreshCalls++;
        return {'access_token': 'new'};
      });
      final api = Dio(BaseOptions(baseUrl: 'http://test.invalid'))
        ..httpClientAdapter = SessionNavigationAdapter(
            (_) => sessionResponse({'message': 'resource error'}, status));
      api.interceptors.add(AuthInterceptor(
          localDataSource: local,
          refresh: SessionRefresh(client: identity, local: local),
          client: api,
          onExpired: () => expired++));
      addTearDown(() {
        api.close();
        identity.close();
      });

      await expectLater(
          api.get('/orders'),
          throwsA(isA<DioException>().having(
              (e) => e.response?.statusCode, 'resource status', status)));
      expect(expired, 0);
      expect(refreshCalls, 0);
      expect(local.value?.token, 'old');
    });
  }

  for (final status in [200, 400, 401, 403, 409, 422, 500]) {
    test('401 then successful refresh then API $status preserves its meaning',
        () async {
      final local = MemorySession(user());
      var expired = 0;
      var refreshCalls = 0;
      final identity = fakeDio((_) {
        refreshCalls++;
        return {'access_token': 'new', 'refresh_token': 'rotated'};
      });
      final headers = <Object?>[];
      final api = Dio(BaseOptions(baseUrl: 'http://test.invalid'))
        ..httpClientAdapter = SessionNavigationAdapter((request) {
          headers.add(request.headers['Authorization']);
          return sessionResponse({'message': 'resource response'},
              headers.length == 1 ? 401 : status);
        });
      api.interceptors.add(AuthInterceptor(
          localDataSource: local,
          refresh: SessionRefresh(client: identity, local: local),
          client: api,
          onExpired: () => expired++));
      addTearDown(() {
        api.close();
        identity.close();
      });

      DioException? resourceError;
      if (status == 200) {
        expect((await api.get('/orders')).statusCode, 200);
      } else {
        // A business error after renewal must not become an auth failure.
        try {
          await api.get('/orders');
          fail('Expected resource error $status');
        } on DioException catch (error) {
          resourceError = error;
        }
      }
      expect(expired, status == 401 ? 1 : 0);
      if (status != 200) {
        expect(resourceError?.response?.statusCode, status,
            reason: 'Expose the replayed resource status');
      }
      expect(refreshCalls, 1);
      expect(headers, ['Bearer old', 'Bearer new']);
      expect(local.value?.refreshToken, 'rotated');
    });
  }

  for (final proactive in [false, true]) {
    for (final status in [400, 401, 403, 500, null]) {
      test('${proactive ? 'Proactive' : 'Reactive'} refresh failure $status',
          () async {
        final local = MemorySession(user(
            token: proactive
                ? sessionToken(
                    DateTime.now().subtract(const Duration(hours: 1)))
                : 'old'));
        var expired = 0;
        var apiCalls = 0;
        var refreshCalls = 0;
        final identity = fakeDio((request) {
          refreshCalls++;
          if (status != null) httpError(request, status);
          throw DioException(
              requestOptions: request,
              type: DioExceptionType.connectionTimeout);
        });
        final api = Dio(BaseOptions(baseUrl: 'http://test.invalid'))
          ..httpClientAdapter = SessionNavigationAdapter((_) {
            apiCalls++;
            return sessionResponse({}, 401);
          });
        api.interceptors.add(AuthInterceptor(
            localDataSource: local,
            refresh: SessionRefresh(client: identity, local: local),
            client: api,
            onExpired: () => expired++));
        addTearDown(() {
          api.close();
          identity.close();
        });

        await expectLater(api.get('/routes'), throwsA(isA<DioException>()));
        expect(expired, status == 400 || status == 401 ? 1 : 0);
        expect(refreshCalls, 1);
        expect(apiCalls, proactive ? 0 : 1);
      });
    }
  }

  test('Late refresh rejection for old account does not expire new account',
      () async {
    final local = MemorySession(user());
    final entered = Completer<void>();
    final rejected = Completer<void>();
    var expired = 0;
    final identity = fakeDio((request) async {
      entered.complete();
      await rejected.future;
      httpError(request, 400);
    });
    final api = Dio(BaseOptions(baseUrl: 'http://test.invalid'))
      ..httpClientAdapter =
          SessionNavigationAdapter((_) => sessionResponse({}, 401));
    final refresh = SessionRefresh(client: identity, local: local);
    api.interceptors.add(AuthInterceptor(
        localDataSource: local,
        refresh: refresh,
        client: api,
        onExpired: () => expired++));
    addTearDown(() {
      api.close();
      identity.close();
    });

    final pending = api.get('/orders');
    final outcome = expectLater(pending, throwsA(isA<DioException>()));
    await entered.future;
    refresh.invalidate();
    local.value = user(subject: 'account-b', token: 'other');
    rejected.complete();
    await outcome;
    expect(expired, 0);
    expect(local.value?.subject, 'account-b');
  });
}
