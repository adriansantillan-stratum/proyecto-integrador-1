import 'package:equatable/equatable.dart';

abstract class RouteEvent extends Equatable {
  const RouteEvent();

  @override
  List<Object> get props => [];
}

class LoadRoutesEvent extends RouteEvent {
  final int driverId;

  const LoadRoutesEvent(this.driverId);

  @override
  List<Object> get props => [driverId];
}
