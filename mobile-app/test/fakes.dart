import 'dart:async';
import 'package:dio/dio.dart';
import 'package:ecoroute_driver_app/features/auth/data/datasources/auth_local_data_source.dart';
import 'package:ecoroute_driver_app/features/auth/data/models/user_model.dart';
import 'package:ecoroute_driver_app/core/error/exceptions.dart';

UserModel user(
        {String subject = 'account-a',
        String token = 'old',
        String id = '7'}) =>
    UserModel(
        id: id,
        email: '',
        name: 'Driver',
        token: token,
        subject: subject,
        refreshToken: 'refresh-$subject',
        roles: ['DRIVER']);

class MemorySession implements AuthLocalDataSource {
  UserModel? value;
  MemorySession(this.value);
  @override
  Future<UserModel> getLastUser() async => value ?? (throw CacheException());
  @override
  Future<void> cacheUser(UserModel user) async {
    value = user;
  }

  @override
  Future<void> clearCache() async {
    value = null;
  }
}

Dio fakeDio(FutureOr<Object?> Function(RequestOptions) answer) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test.invalid'));
  dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) async {
    try {
      h.resolve(
          Response(requestOptions: o, statusCode: 200, data: await answer(o)));
    } on DioException catch (e) {
      h.reject(e);
    } catch (e) {
      h.reject(DioException(requestOptions: o, error: e));
    }
  }));
  return dio;
}

Never httpError(RequestOptions o, int code, [String message = 'Rejected']) =>
    throw DioException(
        requestOptions: o,
        response: Response(
            requestOptions: o, statusCode: code, data: {'message': message}),
        type: DioExceptionType.badResponse);
