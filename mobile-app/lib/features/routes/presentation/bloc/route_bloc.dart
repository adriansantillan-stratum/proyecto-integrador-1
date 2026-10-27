import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_driver_routes.dart';
import 'route_event.dart';
import 'route_state.dart';

class RouteBloc extends Bloc<RouteEvent, RouteState> {
  final GetDriverRoutesUseCase getDriverRoutes;

  RouteBloc({required this.getDriverRoutes}) : super(RouteInitial()) {
    on<LoadRoutesEvent>((event, emit) async {
      emit(RouteLoading());
      final result = await getDriverRoutes(event.driverId);
      result.fold(
        (failure) => emit(RouteError(failure.message)),
        (routes) => emit(RouteLoaded(routes)),
      );
    });
  }
}
