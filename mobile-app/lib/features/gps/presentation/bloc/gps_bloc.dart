import 'dart:async';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/utils/valid_coordinates.dart';
import '../../domain/repositories/gps_repository.dart';
part 'gps_event.dart';
part 'gps_state.dart';

class GpsBloc extends Bloc<GpsEvent, GpsState> {
  final GpsRepository gpsRepository;
  StreamSubscription<Position>? _subscription;
  DateTime? _lastPing;
  GpsBloc({required this.gpsRepository}) : super(const GpsState()) {
    on<AskGpsPermissions>((event, emit) async {
      final result = await gpsRepository.checkAndRequestPermissions();
      await result.fold((f) async => emit(state.copyWith(error: f.message)),
          (granted) async {
        emit(state.copyWith(
            isAllGranted: granted,
            error: granted ? '' : 'Permita ubicación y active GPS'));
        if (!granted) return;
        add(StartTracking());
        try {
          add(OnLocationUpdate(await gpsRepository.getCurrentLocation()));
        } catch (_) {
          emit(state.copyWith(error: 'No se obtuvo GPS actual. Reintente.'));
        }
      });
    });
    on<StartTracking>((event, emit) async {
      if (!state.isAllGranted) return;
      await _subscription?.cancel();
      _subscription = gpsRepository.getLocationStream().listen(
          (p) => add(OnLocationUpdate(p)),
          onError: (Object e) => add(GpsFailed('GPS interrumpido: $e')));
      emit(state.copyWith(isTracking: true));
    });
    on<GpsFailed>((event, emit) => emit(state.copyWith(error: event.message)));
    on<StopTracking>((event, emit) async {
      await _subscription?.cancel();
      gpsRepository.clearRoute();
      _lastPing = null;
      emit(const GpsState());
    });
    on<RouteTrackingChanged>((event, emit) async {
      gpsRepository.setRoute(
          driverId: event.driverId,
          vehicleId: event.vehicleId,
          active: event.active);
      _lastPing = null;
      // Initial ping when either route or position becomes available.
      final p = state.lastKnownPosition;
      if (event.active && p != null) await _ping(p, emit);
    });
    on<OnLocationUpdate>((event, emit) async {
      final p = event.position;
      if (!validCoordinates(p.latitude, p.longitude)) {
        emit(state.copyWith(error: 'Coordenadas GPS inválidas'));
        return;
      }
      emit(state.copyWith(lastKnownPosition: p, error: ''));
      if (_lastPing == null ||
          DateTime.now().difference(_lastPing!) >=
              const Duration(seconds: 10)) {
        await _ping(p, emit);
      }
    });
  }
  Future<void> _ping(Position p, Emitter<GpsState> emit) async {
    _lastPing = DateTime.now();
    final result = await gpsRepository.sendLocationToBackend(p);
    result.fold((f) => emit(state.copyWith(error: f.message)),
        (_) => emit(state.copyWith(error: '')));
  }

  @override
  Future<void> close() async {
    await _subscription?.cancel();
    gpsRepository.clearRoute();
    return super.close();
  }
}
