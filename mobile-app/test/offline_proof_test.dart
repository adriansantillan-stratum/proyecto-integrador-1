import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ecoroute_driver_app/core/cache/local_cache.dart';
import 'package:ecoroute_driver_app/core/sync/proof_sync.dart';
import 'package:ecoroute_driver_app/features/orders/data/repositories/order_repository_impl.dart';
import 'package:ecoroute_driver_app/features/orders/data/datasources/order_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/orders/domain/usecases/update_order_status.dart';
import 'package:ecoroute_driver_app/features/orders/domain/usecases/get_orders_by_route.dart';
import 'package:ecoroute_driver_app/features/orders/presentation/bloc/order_bloc.dart';
import 'package:ecoroute_driver_app/features/orders/presentation/bloc/order_event.dart';
import 'package:ecoroute_driver_app/features/orders/presentation/bloc/order_state.dart';
import 'fakes.dart';

Map<String, dynamic> proof(int id) => {
      'orderId': id,
      'imageUrl': 'cGhvdG8=',
      'signatureDataUrl': 'c2lnbg==',
      'receiverName': 'Receptor',
      'receiverDni': '12345678',
      'latitude': -12.04,
      'longitude': -77.03,
      'verifiedAt': DateTime.now().toUtc().toIso8601String()
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
      'Durable full POD before send; restart, account isolation, orderId first wins',
      () async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'a';
    var online = false;
    var sent = 0;
    final dio = fakeDio((o) async {
      final saved = (await cache.pending('a')).single;
      expect(saved['imageUrl'], 'cGhvdG8=');
      expect(saved['signatureDataUrl'], 'c2lnbg==');
      expect(saved.containsKey('imagePath'), isFalse);
      expect(o.headers['Idempotency-Key'], '41');
      if (!online) throw StateError('Offline');
      sent++;
      return {};
    });
    final first = ProofSync(cache: cache, client: dio);
    expect(await first.submit('a', proof(41)), SubmissionResult.queued);
    await cache.enqueue('a', {...proof(41), 'imageUrl': 'REPLACEMENT'});
    expect((await cache.pending('a')).single['imageUrl'], 'cGhvdG8=');
    first.dispose();
    final restored = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'b';
    final next = ProofSync(cache: restored, client: dio);
    await next.reload();
    expect(next.count, 0);
    online = true;
    await next.sync();
    expect(sent, 0);
    restored.account = 'a';
    await next.reload();
    expect(next.count, 1);
    await next.sync();
    expect(sent, 1);
    expect(await restored.pending('a'), isEmpty);
    next.dispose();
  });
  test('4xx remains visible and manual retry preserves payload', () async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'a';
    var calls = 0;
    var rejected = true;
    final sync = ProofSync(
        cache: cache,
        client: fakeDio((o) {
          calls++;
          if (rejected) httpError(o, 422, 'GPS inválido');
          return {};
        }));
    expect(await sync.submit('a', proof(7)), SubmissionResult.rejected);
    expect(sync.items.single['_error'], contains('422'));
    expect(sync.items.single['receiverDni'], '12345678');
    await sync.sync();
    expect(calls, 1);
    rejected = false;
    await sync.sync(retryRejected: true);
    expect(calls, 2);
    expect(sync.items, isEmpty);
    sync.dispose();
  });
  testWidgets('Foreground timer retries and resume replays after restore',
      (tester) async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'a';
    await cache.enqueue('a', proof(9));
    var sent = 0;
    final sync = ProofSync(
        cache: cache,
        client: fakeDio((o) {
          sent++;
          return {};
        }));
    sync.start();
    await tester.pump(const Duration(seconds: 31));
    await tester.pumpAndSettle();
    expect(sent, 1);
    await cache.enqueue('a', proof(10));
    sync.didChangeAppLifecycleState(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(sent, 2);
    sync.dispose();
  });
  test('Concurrent queue writes and workers do not lose or duplicate orders',
      () async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'a';
    await Future.wait(List.generate(12, (i) => cache.enqueue('a', proof(i))));
    expect((await cache.pending('a')).length, 12);
    final seen = <int>[];
    final sync = ProofSync(
        cache: cache,
        client: fakeDio((o) {
          seen.add(o.data['orderId'] as int);
          return {};
        }));
    await Future.wait([sync.sync(), sync.sync(), sync.sync()]);
    expect(seen.length, 12);
    expect(seen.toSet().length, 12);
    sync.dispose();
  });
  test('BLoC → use case → repository → durable payload includes captured GPS',
      () async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'a';
    Map<String, dynamic>? payload;
    final dio = fakeDio((o) {
      payload = Map<String, dynamic>.from(o.data);
      return {};
    });
    final sync = ProofSync(cache: cache, client: dio);
    final repo = OrderRepositoryImpl(
        remoteDataSource: OrderRemoteDataSourceImpl(client: dio),
        cache: cache,
        sync: sync);
    final bloc = OrderBloc(
        getOrdersByRoute: GetOrdersByRouteUseCase(repo),
        updateOrderStatus: UpdateOrderStatusUseCase(repo));
    final dir = await Directory.systemTemp.createTemp('mobile-proof-test-');
    final image =
        await File('${dir.path}/photo.bin').writeAsBytes([1, 2, 3, 4]);
    final at = DateTime.now().toUtc();
    final done = bloc.stream
        .firstWhere((s) => s is OrderUpdateSuccess || s is OrderError);
    bloc.add(UpdateOrderStatusEvent(15, 'DELIVERED',
        imagePath: image.path,
        signatureBase64: base64Encode([4, 5, 6]),
        receiverName: 'Receptor',
        receiverDni: '12345678',
        lat: -12.1,
        lng: -77.1,
        capturedAt: at));
    final state = await done;
    expect(state, isA<OrderUpdateSuccess>());
    expect((state as OrderUpdateSuccess).result, SubmissionResult.confirmed);
    expect(payload!['latitude'], -12.1);
    expect(payload!['longitude'], -77.1);
    expect(payload!['verifiedAt'], at.toIso8601String());
    expect(payload!['imageUrl'], base64Encode([1, 2, 3, 4]));
    await bloc.close();
    sync.dispose();
    await image.delete();
    await dir.delete();
  });
  test(
      'Incomplete or zero GPS POD never PATCHes delivered or queues invalid proof',
      () async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'a';
    var calls = 0;
    final dio = fakeDio((o) {
      calls++;
      return {};
    });
    final sync = ProofSync(cache: cache, client: dio);
    final repo = OrderRepositoryImpl(
        remoteDataSource: OrderRemoteDataSourceImpl(client: dio),
        cache: cache,
        sync: sync);
    for (final coords in [
      [0.0, -77.0],
      [-12.0, 0.0],
      [double.nan, -77.0]
    ]) {
      final result = await repo.updateOrderStatus(2, 'DELIVERED',
          imagePath: 'unused',
          signatureBase64: 'c2lnbg==',
          receiverName: 'R',
          receiverDni: '12345678',
          lat: coords[0],
          lng: coords[1],
          capturedAt: DateTime.now());
      expect(result.isLeft(), isTrue);
    }
    expect((await repo.updateOrderStatus(2, 'DELIVERED')).isLeft(), isTrue);
    expect(calls, 0);
    expect(await cache.pending('a'), isEmpty);
    sync.dispose();
  });
}
