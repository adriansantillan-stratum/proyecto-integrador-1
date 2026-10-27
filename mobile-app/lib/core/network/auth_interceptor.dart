import 'package:dio/dio.dart';
import '../../features/auth/data/datasources/auth_local_data_source.dart';
import 'session_refresh.dart';

class AuthInterceptor extends Interceptor {
  final AuthLocalDataSource localDataSource;
  final SessionRefresh refresh;
  final Dio client;
  final void Function() onExpired;
  AuthInterceptor(
      {required this.localDataSource,
      required this.refresh,
      required this.client,
      required this.onExpired});
  @override
  Future<void> onRequest(
      RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra['sessionRequest'] != true) {
      try {
        final initial = await localDataSource.getLastUser();
        final owner = options.extra['account'];
        if (owner != null && owner != initial.subject) {
          throw StateError('Cuenta cambió');
        }
        options.extra['account'] = initial.subject;
        final user = await refresh.ensureFresh();
        if (initial.subject != user.subject) throw StateError('Cuenta cambió');
        options.headers['Authorization'] = 'Bearer ${user.token}';
        options.extra['account'] = user.subject;
      } catch (e) {
        if (e is DioException &&
            (e.response?.statusCode == 400 || e.response?.statusCode == 401)) {
          try {
            if ((await localDataSource.getLastUser()).subject ==
                options.extra['account']) {
              onExpired();
            }
          } catch (_) {/* Already logged out. */}
        }
        handler.reject(DioException(
            requestOptions: options, error: e, type: DioExceptionType.cancel));
        return;
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
      DioException err, ErrorInterceptorHandler handler) async {
    final request = err.requestOptions;
    if (err.response?.statusCode != 401 ||
        request.extra['retried'] == true ||
        request.extra['sessionRequest'] == true) {
      handler.next(err);
      return;
    }
    try {
      final user = await refresh.refresh(
          '${request.headers['Authorization']}'.replaceFirst('Bearer ', ''));
      if (request.extra['account'] != user.subject) {
        throw StateError('Cuenta cambió');
      }
      request.extra['retried'] = true;
      request.headers['Authorization'] = 'Bearer ${user.token}';
      try {
        handler.resolve(await client.fetch(request));
      } on DioException catch (replayError) {
        // A resource 400 after successful renewal is not a refresh rejection.
        // Only another 401 still indicates that the session is unusable.
        if (replayError.response?.statusCode == 401) rethrow;
        handler.next(replayError);
      }
    } catch (e) {
      if (e is DioException &&
          (e.response?.statusCode == 400 || e.response?.statusCode == 401)) {
        try {
          final active = await localDataSource.getLastUser();
          if (active.subject == request.extra['account']) onExpired();
        } catch (_) {/* Already logged out. */}
      }
      handler.next(err);
    }
  }
}
