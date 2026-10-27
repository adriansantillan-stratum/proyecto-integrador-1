import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/route.dart';
import '../../domain/repositories/route_repository.dart';
import '../datasources/route_remote_data_source.dart';

class RouteRepositoryImpl implements RouteRepository {
  final RouteRemoteDataSource remoteDataSource;

  RouteRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, List<RouteEntity>>> getDriverRoutes(
      int driverId) async {
    try {
      final routes = await remoteDataSource.getRoutes(driverId: driverId);
      // Filtrar localmente las rutas que pertenecen a este conductor
      final driverRoutes = routes.where((r) => r.driverId == driverId).toList();
      return Right(driverRoutes);
    } catch (e) {
      return Left(ServerFailure(e is ServerException
          ? e.message ?? 'Error al cargar rutas'
          : 'No se pudieron cargar las rutas: $e'));
    }
  }
}
