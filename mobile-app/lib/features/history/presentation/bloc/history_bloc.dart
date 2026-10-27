import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/repositories/history_repository.dart';
import 'history_event.dart';
import 'history_state.dart';

class HistoryBloc extends Bloc<HistoryEvent, HistoryState> {
  int _revision = 0;
  final HistoryRepository historyRepository;

  HistoryBloc({required this.historyRepository}) : super(HistoryInitial()) {
    on<LoadHistory>((event, emit) async {
      final revision = ++_revision;
      emit(HistoryLoading());
      final result =
          await historyRepository.getDeliveryHistory(days: event.days);
      if (revision != _revision) return;
      result.fold(
        (failure) => emit(HistoryError(failure.message)),
        (history) => emit(HistoryLoaded(history)),
      );
    });
  }
}
