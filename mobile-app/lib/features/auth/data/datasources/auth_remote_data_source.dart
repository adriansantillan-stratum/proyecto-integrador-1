import 'package:dio/dio.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/network/api_config.dart';
import '../models/user_model.dart';

abstract class AuthRemoteDataSource {
  Future<UserModel> login(String username, String password);
  Future<void> logout(String refreshToken);
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final Dio client;
  final Dio apiClient;
  AuthRemoteDataSourceImpl({required this.client, required this.apiClient});
  @override
  Future<UserModel> login(String username, String password) async {
    try {
      final token = await client.post('${ApiConfig.oidcPath}/token',
          data: {
            'client_id': ApiConfig.clientId,
            'grant_type': 'password',
            'username': username,
            'password': password,
          },
          options: Options(contentType: Headers.formUrlEncodedContentType));
      final access = token.data['access_token'] as String? ?? '';
      final refresh = token.data['refresh_token'] as String? ?? '';
      if (access.isEmpty || refresh.isEmpty) {
        throw ServerException('Sesión incompleta de Keycloak');
      }
      try {
        final me = await apiClient.get('/session/me',
            options: Options(
                headers: {'Authorization': 'Bearer $access'},
                extra: {'sessionRequest': true}));
        final data = Map<String, dynamic>.from(me.data);
        final id = int.tryParse('${data['driverId']}');
        final subject = data['subject']?.toString() ?? '';
        // Spring Security serializes GrantedAuthority as {authority: ROLE_DRIVER}.
        final roles = (data['roles'] as List? ?? [])
            .map((r) =>
                r is Map ? r['authority']?.toString() ?? '' : r.toString())
            .where((r) => r.isNotEmpty)
            .toList();
        if (id == null ||
            id <= 0 ||
            subject.isEmpty ||
            !roles.any(
                (r) => r.toUpperCase().replaceFirst('ROLE_', '') == 'DRIVER')) {
          throw ServerException(
              'La cuenta no tiene conductor vinculado y autorizado');
        }
        return UserModel(
            id: '$id',
            email: '',
            name: username,
            token: access,
            subject: subject,
            refreshToken: refresh,
            roles: roles);
      } catch (_) {
        try {
          await logout(refresh);
        } catch (_) {/* Preserve identity error. */}
        rethrow;
      }
    } on DioException catch (e) {
      throw ServerException(
          'No se pudo iniciar sesión (${e.response?.statusCode ?? 'sin conexión'}). Verifique credenciales y vínculo del conductor.');
    }
  }

  @override
  Future<void> logout(String refreshToken) async {
    await client.post('${ApiConfig.oidcPath}/logout',
        data: {
          'client_id': ApiConfig.clientId,
          'refresh_token': refreshToken,
        },
        options: Options(contentType: Headers.formUrlEncodedContentType));
  }
}
