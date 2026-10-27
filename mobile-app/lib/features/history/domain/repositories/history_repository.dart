import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/delivery_history.dart';

abstract class HistoryRepository {
  Future<Either<Failure, List<DeliveryHistory>>> getDeliveryHistory(
      {int days = 30});
}
