import 'package:dio/dio.dart';
import 'dart:convert';
import '../../features/auth/data/datasources/auth_local_data_source.dart';
import '../../features/auth/data/models/user_model.dart';
import 'api_config.dart';

class SessionRefresh {
  final Dio client;
  final AuthLocalDataSource local;
  Future<UserModel>? _flight;
  int _generation = 0;
  SessionRefresh({required this.client, required this.local});
  void invalidate() {
    _generation++;
    _flight = null;
  }

  static DateTime? expiry(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final claims = jsonDecode(
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1])))) as Map;
      final exp = claims['exp'];
      return exp is num
          ? DateTime.fromMillisecondsSinceEpoch((exp * 1000).round(),
              isUtc: true)
          : null;
    } catch (_) {
      return null;
    }
  }

  Future<UserModel> ensureFresh() async {
    final current = await local.getLastUser();
    final exp = expiry(current.token);
    // exp is only a refresh hint. Identity/roles always come from /session/me.
    if (exp != null &&
        !exp.isAfter(DateTime.now().toUtc().add(const Duration(seconds: 30)))) {
      return refresh(current.token);
    }
    return current;
  }

  Future<UserModel> refresh(String rejectedToken) async {
    final current = await local.getLastUser();
    if (current.token != rejectedToken) return current;
    final existing = _flight;
    if (existing != null) return existing;
    late final Future<UserModel> work;
    work = _perform(current, _generation).whenComplete(() {
      if (identical(_flight, work)) _flight = null;
    });
    _flight = work;
    return work;
  }

  Future<UserModel> _perform(UserModel old, int generation) async {
    if (old.refreshToken.isEmpty) throw StateError('Sesión sin refresh token');
    final response = await client.post('${ApiConfig.oidcPath}/token',
        data: {
          'client_id': ApiConfig.clientId,
          'grant_type': 'refresh_token',
          'refresh_token': old.refreshToken,
        },
        options: Options(contentType: Headers.formUrlEncodedContentType));
    final active = await local.getLastUser();
    if (generation != _generation ||
        active.subject != old.subject ||
        active.token != old.token) {
      throw StateError('La sesión cambió durante la renovación');
    }
    final access = response.data['access_token'] as String? ?? '';
    if (access.isEmpty) throw StateError('Renovación sin access token');
    final updated = UserModel(
        id: old.id,
        email: old.email,
        name: old.name,
        token: access,
        refreshToken: response.data['refresh_token'] ?? old.refreshToken,
        subject: old.subject,
        roles: old.roles);
    await local.cacheUser(updated);
    return updated;
  }
}
