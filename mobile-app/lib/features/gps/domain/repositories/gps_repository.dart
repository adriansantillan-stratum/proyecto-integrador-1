import 'package:dartz/dartz.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/error/failures.dart';

abstract class GpsRepository {
  void setRoute(
      {required int driverId, required int vehicleId, required bool active});
  void clearRoute();
  Future<Position> getCurrentLocation();

  /// Solicita permisos de ubicación
  Future<Either<Failure, bool>> checkAndRequestPermissions();

  /// Obtiene el Stream de ubicación del dispositivo
  Stream<Position> getLocationStream();

  /// Envía la ubicación actual al Backend (WebFlux)
  Future<Either<Failure, void>> sendLocationToBackend(Position position);
}
