import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/order.dart';
import '../../../../core/sync/proof_sync.dart';

abstract class OrderRepository {
  Future<Either<Failure, List<OrderEntity>>> getOrdersByRoute(int routeId);
  Future<Either<Failure, SubmissionResult>> updateOrderStatus(
      int orderId, String status,
      {String? imagePath,
      String? signatureBase64,
      String? receiverName,
      String? receiverDni,
      double? lat,
      double? lng,
      DateTime? capturedAt,
      String? reason});
}
