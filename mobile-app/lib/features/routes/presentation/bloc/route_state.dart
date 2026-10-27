import 'package:equatable/equatable.dart';
import '../../domain/entities/route.dart';

abstract class RouteState extends Equatable {
  const RouteState();

  @override
  List<Object> get props => [];
}

class RouteInitial extends RouteState {}

class RouteLoading extends RouteState {}

class RouteLoaded extends RouteState {
  final List<RouteEntity> routes;

  const RouteLoaded(this.routes);

  @override
  List<Object> get props => [routes];
}

class RouteError extends RouteState {
  final String message;

  const RouteError(this.message);

  @override
  List<Object> get props => [message];
}
