import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/delivery_history.dart';
import '../../domain/repositories/history_repository.dart';
import '../datasources/history_remote_data_source.dart';

class HistoryRepositoryImpl implements HistoryRepository {
  final HistoryRemoteDataSource remoteDataSource;

  HistoryRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, List<DeliveryHistory>>> getDeliveryHistory(
      {int days = 30}) async {
    try {
      final history = await remoteDataSource.getDeliveryHistory(days: days);
      return Right(history);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message ?? 'Error al obtener historial'));
    }
  }
}
