import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../repositories/order_repository.dart';
import '../../../../core/sync/proof_sync.dart';

class UpdateOrderStatusUseCase {
  final OrderRepository repository;

  UpdateOrderStatusUseCase(this.repository);

  Future<Either<Failure, SubmissionResult>> call(
    int orderId,
    String status, {
    String? imagePath,
    String? signatureBase64,
    String? receiverName,
    String? receiverDni,
    double? lat,
    double? lng,
    DateTime? capturedAt,
    String? reason,
  }) async {
    return await repository.updateOrderStatus(
      orderId,
      status,
      imagePath: imagePath,
      signatureBase64: signatureBase64,
      receiverName: receiverName,
      receiverDni: receiverDni,
      lat: lat,
      lng: lng,
      capturedAt: capturedAt,
      reason: reason,
    );
  }
}
