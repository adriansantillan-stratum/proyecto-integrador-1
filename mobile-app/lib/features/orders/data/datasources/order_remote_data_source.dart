import 'package:dio/dio.dart';
import '../models/order_model.dart';

abstract class OrderRemoteDataSource {
  Future<List<OrderModel>> getOrders();
  Future<List<OrderModel>> getOrdersByRoute(int routeId);
  Future<void> updateOrderStatus(int orderId, String status, {String? reason});
}

class OrderRemoteDataSourceImpl implements OrderRemoteDataSource {
  final Dio client;
  OrderRemoteDataSourceImpl({required this.client});
  @override
  Future<List<OrderModel>> getOrders() async {
    final response = await client.get('/orders');
    return (response.data as List).map((j) => OrderModel.fromJson(j)).toList();
  }

  @override
  Future<List<OrderModel>> getOrdersByRoute(int routeId) async {
    final response =
        await client.get('/orders', queryParameters: {'routeId': routeId});
    return (response.data as List)
        .map((j) => OrderModel.fromJson(j))
        .where((o) => o.routeId == routeId)
        .toList();
  }

  @override
  Future<void> updateOrderStatus(int orderId, String status,
      {String? reason}) async {
    if (status == 'DELIVERED') {
      throw StateError('La entrega requiere evidencia completa');
    }
    await client.patch('/orders/$orderId/status', data: {
      'status': status,
      'reason': reason ?? 'Actualizado desde App Móvil',
    });
  }
}
