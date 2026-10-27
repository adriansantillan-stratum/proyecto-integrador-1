import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/route.dart';
import '../repositories/route_repository.dart';

class GetDriverRoutesUseCase {
  final RouteRepository repository;

  GetDriverRoutesUseCase(this.repository);

  Future<Either<Failure, List<RouteEntity>>> call(int driverId) async {
    return await repository.getDriverRoutes(driverId);
  }
}
