import 'dart:io';
import 'dart:convert';
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import '../../../../core/cache/local_cache.dart';
import '../../../../core/sync/proof_sync.dart';
import '../../../../core/utils/valid_coordinates.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/order.dart';
import '../../domain/repositories/order_repository.dart';
import '../models/order_model.dart';
import '../datasources/order_remote_data_source.dart';

class OrderRepositoryImpl implements OrderRepository {
  final OrderRemoteDataSource remoteDataSource;
  final LocalCache cache;
  final ProofSync sync;
  OrderRepositoryImpl(
      {required this.remoteDataSource,
      required this.cache,
      required this.sync});
  @override
  Future<Either<Failure, List<OrderEntity>>> getOrdersByRoute(
      int routeId) async {
    try {
      final owner = cache.requireAccount();
      try {
        final orders = await remoteDataSource.getOrdersByRoute(routeId);
        if (cache.account != owner) {
          return const Left(ServerFailure('La sesión cambió'));
        }
        await cache.write(
            owner, 'orders_$routeId', orders.map((o) => o.toJson()).toList());
        return Right(orders);
      } on DioException catch (e) {
        if (e.response != null) rethrow;
        final saved = await cache.read(owner, 'orders_$routeId') as List?;
        if (saved == null || cache.account != owner) rethrow;
        return Right(saved
            .map((j) =>
                OrderModel.fromJson(Map<String, dynamic>.from(j), cached: true))
            .toList());
      }
    } catch (e) {
      return Left(ServerFailure(
          'Error al obtener pedidos: ${e is ServerException ? e.message : e}'));
    }
  }

  @override
  Future<Either<Failure, SubmissionResult>> updateOrderStatus(
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
    try {
      final owner = cache.requireAccount();
      if (status == 'DELIVERED') {
        if (imagePath == null ||
            (signatureBase64?.isEmpty ?? true) ||
            (receiverName?.trim().isEmpty ?? true) ||
            !RegExp(r'^\d{8}$').hasMatch(receiverDni ?? '') ||
            receiverDni == '00000000' ||
            !validCoordinates(lat, lng) ||
            capturedAt == null ||
            DateTime.now().difference(capturedAt).abs() >
                const Duration(minutes: 2)) {
          return const Left(ServerFailure(
              'Foto, firma, receptor, DNI válido y GPS reciente son obligatorios'));
        }
        final bytes = await File(imagePath).readAsBytes();
        if (bytes.isEmpty ||
            base64Decode(signatureBase64!.split(',').last).isEmpty) {
          return const Left(ServerFailure('La foto o firma está vacía'));
        }
        if (cache.account != owner) {
          return const Left(ServerFailure('La sesión cambió'));
        }
        final result = await sync.submit(owner, {
          'orderId': orderId,
          'imageUrl': base64Encode(bytes),
          'signatureDataUrl': signatureBase64,
          'receiverName': receiverName!.trim(),
          'receiverDni': receiverDni,
          'latitude': lat,
          'longitude': lng,
          'verifiedAt': capturedAt.toUtc().toIso8601String(),
        });
        return Right(result);
      }
      if (['FAILED', 'RETURNED'].contains(status) &&
          (reason?.trim().length ?? 0) < 5) {
        return const Left(ServerFailure(
            'Describa el motivo de no entrega (mínimo 5 caracteres)'));
      }
      await remoteDataSource.updateOrderStatus(orderId, status, reason: reason);
      return const Right(SubmissionResult.confirmed);
    } catch (e) {
      return Left(
          ServerFailure('No se pudo guardar o actualizar la operación: $e'));
    }
  }
}
