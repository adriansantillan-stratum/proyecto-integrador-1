import 'package:dio/dio.dart';
import '../../../../core/cache/local_cache.dart';
import '../../../../core/error/exceptions.dart';
import '../../../auth/data/datasources/auth_local_data_source.dart';
import '../models/delivery_history_model.dart';

abstract class HistoryRemoteDataSource {
  Future<List<DeliveryHistoryModel>> getDeliveryHistory({int days = 30});
}

class HistoryRemoteDataSourceImpl implements HistoryRemoteDataSource {
  final Dio client;
  final LocalCache cache;
  final AuthLocalDataSource local;
  HistoryRemoteDataSourceImpl(
      {required this.client, required this.cache, required this.local});
  @override
  Future<List<DeliveryHistoryModel>> getDeliveryHistory({int days = 30}) async {
    try {
      final owner = cache.requireAccount();
      final user = await local.getLastUser();
      if (user.subject != owner) throw StateError('La sesión cambió');
      final routes = await client.get('/routes',
          options: Options(extra: {'account': owner}));
      final routeIds = (routes.data as List)
          .where((r) => '${r['driverId']}' == user.id)
          .map((r) => r['id'])
          .toSet();
      final response = await client.get('/orders',
          options: Options(extra: {'account': owner}));
      if (cache.account != owner) throw StateError('La sesión cambió');
      final now = DateTime.now();
      final from = DateTime(now.year, now.month, now.day)
          .subtract(Duration(days: days - 1));
      final end = DateTime(now.year, now.month, now.day + 1);
      final result = <DeliveryHistoryModel>[];
      for (final row in response.data as List) {
        if (!routeIds.contains(row['routeId']) ||
            !['DELIVERED', 'FAILED', 'RETURNED'].contains(row['status'])) {
          continue;
        }
        final item =
            DeliveryHistoryModel.fromJson(Map<String, dynamic>.from(row));
        final at = DateTime.tryParse(item.deliveredAt ?? '');
        if (at == null) {
          throw ServerException(
              'El pedido #${item.orderId} no tiene fecha verificable para filtrar el historial');
        }
        if (!at.isBefore(from) && at.isBefore(end)) result.add(item);
      }
      result.sort((a, b) => DateTime.parse(b.deliveredAt!)
          .compareTo(DateTime.parse(a.deliveredAt!)));
      return result;
    } on ServerException {
      rethrow;
    } catch (_) {
      throw ServerException(
          'No se pudo verificar el historial de su cuenta. Reintente con conexión.');
    }
  }
}
