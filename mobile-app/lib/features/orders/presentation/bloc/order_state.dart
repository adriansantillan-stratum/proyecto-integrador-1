import 'package:equatable/equatable.dart';
import '../../domain/entities/order.dart';
import '../../../../core/sync/proof_sync.dart';

abstract class OrderState extends Equatable {
  final List<OrderEntity> orders;
  const OrderState({this.orders = const []});

  @override
  List<Object> get props => [orders];
}

class OrderInitial extends OrderState {}

class OrderLoading extends OrderState {
  const OrderLoading({super.orders});
}

class OrderLoaded extends OrderState {
  const OrderLoaded(List<OrderEntity> orders) : super(orders: orders);
}

class OrderError extends OrderState {
  final String message;

  const OrderError(this.message, {super.orders});

  @override
  List<Object> get props => [message, orders];
}

class OrderUpdating extends OrderState {
  const OrderUpdating(List<OrderEntity> orders) : super(orders: orders);
}

class OrderUpdateSuccess extends OrderState {
  final SubmissionResult result;
  const OrderUpdateSuccess(List<OrderEntity> orders, this.result)
      : super(orders: orders);
  @override
  List<Object> get props => [orders, result];
}
