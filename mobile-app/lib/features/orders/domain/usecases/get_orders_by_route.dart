import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/order.dart';
import '../repositories/order_repository.dart';

class GetOrdersByRouteUseCase {
  final OrderRepository repository;

  GetOrdersByRouteUseCase(this.repository);

  Future<Either<Failure, List<OrderEntity>>> call(int routeId) async {
    return await repository.getOrdersByRoute(routeId);
  }
}
