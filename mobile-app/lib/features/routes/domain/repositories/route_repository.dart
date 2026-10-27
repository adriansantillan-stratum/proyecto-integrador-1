import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/route.dart';

abstract class RouteRepository {
  Future<Either<Failure, List<RouteEntity>>> getDriverRoutes(int driverId);
}
