import 'package:equatable/equatable.dart';

abstract class HistoryEvent extends Equatable {
  const HistoryEvent();

  @override
  List<Object> get props => [];
}

class LoadHistory extends HistoryEvent {
  final int days;
  const LoadHistory({this.days = 30});
  @override
  List<Object> get props => [days];
}
