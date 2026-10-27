part of 'gps_bloc.dart';

class GpsState extends Equatable {
  final bool isAllGranted;
  final bool isTracking;
  final Position? lastKnownPosition;
  final String error;

  const GpsState({
    this.isAllGranted = false,
    this.isTracking = false,
    this.lastKnownPosition,
    this.error = '',
  });

  GpsState copyWith({
    bool? isAllGranted,
    bool? isTracking,
    Position? lastKnownPosition,
    String? error,
  }) {
    return GpsState(
      isAllGranted: isAllGranted ?? this.isAllGranted,
      isTracking: isTracking ?? this.isTracking,
      lastKnownPosition: lastKnownPosition ?? this.lastKnownPosition,
      error: error ?? this.error,
    );
  }

  @override
  List<Object?> get props =>
      [isAllGranted, isTracking, lastKnownPosition, error];
}
