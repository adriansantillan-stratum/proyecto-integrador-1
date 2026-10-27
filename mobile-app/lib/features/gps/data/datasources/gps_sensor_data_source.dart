import 'package:geolocator/geolocator.dart';
import 'package:flutter/foundation.dart';

abstract class GpsSensorDataSource {
  /// Verifica y solicita permisos al usuario. Retorna true si se concedieron.
  Future<bool> checkAndRequestPermissions();

  /// Obtiene la ubicación actual una sola vez
  Future<Position> getCurrentLocation();

  /// Retorna un flujo continuo (Stream) de coordenadas cada vez que el conductor se mueve
  Stream<Position> getLocationStream();
}

class GpsSensorDataSourceImpl implements GpsSensorDataSource {
  @override
  Future<bool> checkAndRequestPermissions() async {
    bool serviceEnabled;
    LocationPermission permission;

    // 1. Validar si el GPS (hardware) está encendido
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false; // El usuario tiene el GPS apagado
    }

    // 2. Revisar permisos de la app
    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false; // Permiso denegado por el usuario
      }
    }

    if (permission == LocationPermission.deniedForever) {
      // Permiso denegado permanentemente, se debe redirigir a ajustes
      return false;
    }

    return true; // Todo correcto, podemos trackear
  }

  @override
  Future<Position> getCurrentLocation() async {
    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
      forceAndroidLocationManager: true,
      timeLimit: const Duration(seconds: 15),
    );
  }

  @override
  Stream<Position> getLocationStream() {
    return Geolocator.getPositionStream(
      locationSettings: defaultTargetPlatform == TargetPlatform.android
          ? AndroidSettings(
              forceLocationManager: true,
              accuracy: LocationAccuracy.best,
              distanceFilter: 15)
          : const LocationSettings(
              accuracy: LocationAccuracy.best, // Mayor precisión posible
              distanceFilter: 15,
            ),
    );
  }
}
