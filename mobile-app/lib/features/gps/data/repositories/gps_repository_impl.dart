import 'package:dartz/dartz.dart';
import 'package:geolocator/geolocator.dart';
import 'package:dio/dio.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/utils/valid_coordinates.dart';
import '../../domain/repositories/gps_repository.dart';
import '../datasources/gps_sensor_data_source.dart';

class GpsRepositoryImpl implements GpsRepository {
  final GpsSensorDataSource sensorDataSource;
  final Dio apiClient;
  int? _driverId;
  int? _vehicleId;
  GpsRepositoryImpl({required this.sensorDataSource, required this.apiClient});
  @override
  void setRoute(
      {required int driverId, required int vehicleId, required bool active}) {
    clearRoute();
    if (active && driverId > 0 && vehicleId > 0) {
      _driverId = driverId;
      _vehicleId = vehicleId;
    }
  }

  @override
  void clearRoute() {
    _driverId = null;
    _vehicleId = null;
  }

  @override
  Future<Position> getCurrentLocation() =>
      sensorDataSource.getCurrentLocation();
  @override
  Future<Either<Failure, bool>> checkAndRequestPermissions() async {
    try {
      return Right(await sensorDataSource.checkAndRequestPermissions());
    } catch (_) {
      return const Left(ServerFailure('Error al verificar permisos GPS'));
    }
  }

  @override
  Stream<Position> getLocationStream() => sensorDataSource.getLocationStream();
  @override
  Future<Either<Failure, void>> sendLocationToBackend(Position position) async {
    if (_driverId == null || _vehicleId == null) {
      return const Left(
          ServerFailure('Seleccione una ruta activa con vehículo'));
    }
    if (!validCoordinates(position.latitude, position.longitude) ||
        DateTime.now().difference(position.timestamp).abs() >
            const Duration(minutes: 2)) {
      return const Left(ServerFailure('GPS inválido o antiguo'));
    }
    try {
      await apiClient.post('/gps/ping', data: {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'speedKmh': position.speed.isFinite && position.speed > 0
            ? position.speed * 3.6
            : 0,
        'headingDegrees': position.heading.isFinite && position.heading >= 0
            ? position.heading
            : 0,
        'driverId': _driverId,
        'vehicleId': _vehicleId,
      });
      return const Right(null);
    } catch (_) {
      return const Left(
          ServerFailure('No se pudo enviar ubicación al servidor'));
    }
  }
}
