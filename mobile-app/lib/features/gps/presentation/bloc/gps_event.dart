part of 'gps_bloc.dart';

abstract class GpsEvent extends Equatable {
  const GpsEvent();

  @override
  List<Object?> get props => [];
}

class AskGpsPermissions extends GpsEvent {}

class StartTracking extends GpsEvent {}

class StopTracking extends GpsEvent {}

class GpsFailed extends GpsEvent {
  final String message;
  const GpsFailed(this.message);
  @override
  List<Object?> get props => [message];
}

class RouteTrackingChanged extends GpsEvent {
  final int driverId;
  final int vehicleId;
  final bool active;
  const RouteTrackingChanged(this.driverId, this.vehicleId, this.active);
  @override
  List<Object?> get props => [driverId, vehicleId, active];
}

class OnLocationUpdate extends GpsEvent {
  final Position position;
  const OnLocationUpdate(this.position);

  @override
  List<Object?> get props => [position];
}
