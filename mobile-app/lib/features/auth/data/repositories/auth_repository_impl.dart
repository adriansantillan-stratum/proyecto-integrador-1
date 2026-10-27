import 'package:dartz/dartz.dart';
import '../../../../core/cache/local_cache.dart';
import '../../../../core/network/session_refresh.dart';
import '../../../../core/sync/proof_sync.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_local_data_source.dart';
import '../datasources/auth_remote_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final AuthLocalDataSource localDataSource;
  final LocalCache cache;
  final ProofSync sync;
  final SessionRefresh refresh;
  AuthRepositoryImpl(
      {required this.remoteDataSource,
      required this.localDataSource,
      required this.cache,
      required this.sync,
      required this.refresh});
  @override
  Future<Either<Failure, User>> login(String username, String password) async {
    try {
      final user = await remoteDataSource.login(username, password);
      refresh.invalidate();
      await localDataSource.cacheUser(user);
      cache.account = user.subject;
      sync.accountChanged();
      return Right(user);
    } catch (e) {
      return Left(ServerFailure(e is ServerException
          ? e.message ?? 'Error de sesión'
          : 'No se pudo iniciar sesión'));
    }
  }

  @override
  Future<Either<Failure, void>> logout() async {
    cache.account = null;
    sync.accountChanged();
    refresh.invalidate();
    String token = '';
    try {
      token = (await localDataSource.getLastUser()).refreshToken;
    } catch (_) {/* No session. */}
    try {
      await localDataSource.clearCache();
    } catch (_) {
      return const Left(CacheFailure(
          'No se pudo eliminar la sesión local. Cierre la aplicación y revise el almacenamiento.'));
    }
    if (token.isNotEmpty) {
      try {
        await remoteDataSource.logout(token);
      } catch (_) {
        return const Left(ServerFailure(
            'Sesión local cerrada. No se pudo confirmar la revocación en Keycloak; la evidencia pendiente se conserva en su cuenta.'));
      }
    }
    return const Right(null);
  }

  @override
  Future<Either<Failure, User>> checkAuthStatus() async {
    try {
      final user = await localDataSource.getLastUser();
      if (user.subject.isEmpty ||
          user.refreshToken.isEmpty ||
          int.tryParse(user.id) == null) {
        return const Left(
            CacheFailure('Inicie sesión para vincular su cuenta'));
      }
      cache.account = user.subject;
      sync.accountChanged();
      return Right(user);
    } catch (_) {
      return const Left(CacheFailure('No hay sesión activa guardada'));
    }
  }
}
