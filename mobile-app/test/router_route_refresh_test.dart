import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:ecoroute_driver_app/core/cache/local_cache.dart';
import 'package:ecoroute_driver_app/core/di/injection_container.dart';
import 'package:ecoroute_driver_app/core/router/app_router.dart';
import 'package:ecoroute_driver_app/core/sync/proof_sync.dart';
import 'package:ecoroute_driver_app/core/sync/sync_page.dart';
import 'package:ecoroute_driver_app/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:ecoroute_driver_app/features/auth/presentation/bloc/auth_state.dart';
import 'package:ecoroute_driver_app/features/gps/presentation/bloc/gps_bloc.dart';
import 'package:ecoroute_driver_app/features/orders/data/datasources/order_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/orders/data/repositories/order_repository_impl.dart';
import 'package:ecoroute_driver_app/features/orders/domain/entities/order.dart';
import 'package:ecoroute_driver_app/features/orders/domain/usecases/get_orders_by_route.dart';
import 'package:ecoroute_driver_app/features/orders/domain/usecases/update_order_status.dart';
import 'package:ecoroute_driver_app/features/orders/presentation/bloc/order_bloc.dart';
import 'package:ecoroute_driver_app/features/orders/presentation/pages/order_detail_page.dart';
import 'package:ecoroute_driver_app/features/routes/data/datasources/route_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/routes/data/repositories/route_repository_impl.dart';
import 'package:ecoroute_driver_app/features/routes/domain/usecases/get_driver_routes.dart';
import 'package:ecoroute_driver_app/features/routes/presentation/bloc/route_bloc.dart';
import 'package:ecoroute_driver_app/features/routes/presentation/pages/routes_page.dart';
import 'fakes.dart';

class _AuthenticatedBloc extends Cubit<AuthState> implements AuthBloc {
  _AuthenticatedBloc() : super(Authenticated(user: user()));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _GpsBloc extends Cubit<GpsState> implements GpsBloc {
  final tracking = <RouteTrackingChanged>[];
  _GpsBloc() : super(const GpsState());

  @override
  void add(GpsEvent event) {
    if (event is RouteTrackingChanged) tracking.add(event);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

OrderEntity _order() => OrderEntity(
      id: 27,
      trackingNumber: 'TEST27',
      routeId: 11,
      status: 'IN_TRANSIT',
      recipientName: 'Receptor de prueba',
      deliveryAddress: 'Dirección de prueba',
    );

class _Harness {
  final auth = _AuthenticatedBloc();
  final gps = _GpsBloc();
  final cache = LocalCache(storage: const FlutterSecureStorage())
    ..account = 'test-account';
  final calls = <String>[];
  final orderRoutes = <Object?>[];
  String routeStatus = 'IN_PROGRESS';
  String orderStatus = 'IN_TRANSIT';
  late final ProofSync sync;
  late final RouteBloc routes;
  late final OrderBloc orders;
  late final GoRouter router;

  _Harness() {
    final dio = fakeDio((request) {
      calls.add('${request.method} ${request.path}');
      if (request.path == '/routes') {
        return [
          for (final id in [12, 11])
            {
              'id': id,
              'driverId': 7,
              'vehicleId': id + 30,
              'routeDate': '2026-10-20',
              'status': id == 11 ? routeStatus : 'IN_PROGRESS',
            }
        ];
      }
      if (request.path == '/orders') {
        orderRoutes.add(request.queryParameters['routeId']);
        return [
          {
            'id': 27,
            'routeId': 11,
            'trackingNumber': 'TEST27',
            'status': orderStatus,
            'recipientName': 'Receptor de prueba',
            'deliveryAddress': 'Dirección de prueba',
          }
        ];
      }
      if (request.path.endsWith('/review')) {
        return {'approved': true, 'accepted': true};
      }
      if (request.path.endsWith('/path')) return {'source': 'haversine'};
      throw StateError('Unexpected request: ${request.method} ${request.path}');
    });
    sync = ProofSync(cache: cache, client: dio);
    final source = RouteRemoteDataSourceImpl(client: dio, cache: cache);
    sl.registerSingleton<LocalCache>(cache);
    sl.registerSingleton<ProofSync>(sync);
    sl.registerSingleton<RouteRemoteDataSource>(source);
    routes = RouteBloc(
        getDriverRoutes: GetDriverRoutesUseCase(
            RouteRepositoryImpl(remoteDataSource: source)));
    final repo = OrderRepositoryImpl(
        remoteDataSource: OrderRemoteDataSourceImpl(client: dio),
        cache: cache,
        sync: sync);
    orders = OrderBloc(
        getOrdersByRoute: GetOrdersByRouteUseCase(repo),
        updateOrderStatus: UpdateOrderStatusUseCase(repo));
  }

  int get routeLoads => calls.where((call) => call == 'GET /routes').length;

  Future<void> mount(WidgetTester tester, {bool appRouter = false}) async {
    await cache.write('test-account', 'selected_route', 11);
    router = appRouter
        ? createAppRouter(auth)
        : GoRouter(initialLocation: '/routes', routes: [
            GoRoute(path: '/routes', builder: (_, __) => const RoutesPage()),
            GoRoute(
                path: '/orders/:id',
                builder: (_, state) {
                  final args =
                      state.extra as ({OrderEntity order, bool canOperate});
                  return OrderDetailPage(
                      order: args.order, canOperate: args.canOperate);
                }),
            GoRoute(path: '/sync', builder: (_, __) => const SyncPage()),
            GoRoute(
                path: '/away',
                builder: (_, __) => const Scaffold(body: Text('Otra página'))),
          ]);
    tester.view.physicalSize = const Size(1000, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox.shrink());
      router.dispose();
      await orders.close();
      await routes.close();
      await gps.close();
      await auth.close();
      sync.dispose();
      await sl.reset();
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    await tester.pumpWidget(MultiBlocProvider(providers: [
      BlocProvider<AuthBloc>.value(value: auth),
      BlocProvider<RouteBloc>.value(value: routes),
      BlocProvider<OrderBloc>.value(value: orders),
      BlocProvider<GpsBloc>.value(value: gps),
    ], child: MaterialApp.router(routerConfig: router)));
    await tester.pumpAndSettle();
  }

  void complete(String status) {
    routeStatus = 'COMPLETED';
    orderStatus = status;
  }
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  final malformed = <String, Object?>{
    'null': null,
    'string': '27',
    'map': {'order': _order(), 'canOperate': true},
    'wrong order type': (order: 27, canOperate: true),
    'wrong permission type': (order: _order(), canOperate: 'true'),
    'missing permission': (order: _order()),
  };
  for (final entry in malformed.entries) {
    testWidgets('Order link recovers safely with ${entry.key} extra',
        (tester) async {
      final h = _Harness();
      await h.mount(tester, appRouter: true);
      final loads = h.routeLoads;
      final orderLoads = h.orderRoutes.length;
      h.router.go('/orders/27', extra: entry.value);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(
          find.text(
              'Enlace de pedido incompleto. Abra el pedido desde Mis rutas'),
          findsOneWidget);
      expect(find.byType(OrderDetailPage), findsNothing);
      expect(h.routeLoads, loads);
      expect(h.orderRoutes.length, orderLoads);
      await tester.tap(find.text('Ir a Mis rutas'));
      await tester.pumpAndSettle();
      expect(h.router.routeInformationProvider.value.uri.path, '/routes');
      expect(find.byType(RoutesPage), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  for (final id in ['28', 'invalid']) {
    testWidgets('Order link rejects incoherent path id $id', (tester) async {
      final h = _Harness();
      await h.mount(tester, appRouter: true);
      h.router.go('/orders/$id', extra: (order: _order(), canOperate: true));
      await tester.pumpAndSettle();
      expect(find.byType(OrderDetailPage), findsNothing);
      expect(find.text('Ir a Mis rutas'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  for (final canOperate in [false, true]) {
    testWidgets('Coherent order link preserves canOperate=$canOperate',
        (tester) async {
      final h = _Harness();
      await h.mount(tester, appRouter: true);
      final order = _order();
      h.router.go('/orders/27', extra: (order: order, canOperate: canOperate));
      await tester.pumpAndSettle();
      final page = tester.widget<OrderDetailPage>(find.byType(OrderDetailPage));
      expect(page.order, same(order));
      expect(page.canOperate, canOperate);
      expect(find.text('Ir a Mis rutas'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }

  for (final status in ['DELIVERED', 'FAILED']) {
    testWidgets(
        'Returning after last $status refreshes selected completed route',
        (tester) async {
      final h = _Harness();
      await h.mount(tester);
      final loads = h.routeLoads;
      expect(
          tester
              .widget<DropdownButton<int>>(find.byType(DropdownButton<int>))
              .value,
          11);
      await tester.tap(find.text('#TEST27 · IN_TRANSIT'));
      await tester.pumpAndSettle();
      expect(find.byType(OrderDetailPage), findsOneWidget);
      expect(h.routeLoads, loads);
      h.complete(status);
      h.router.pop();
      await tester.pumpAndSettle();
      expect(h.routeLoads, loads + 1);
      expect(
          tester
              .widget<DropdownButton<int>>(find.byType(DropdownButton<int>))
              .value,
          11);
      expect(find.textContaining('Ruta #11 · 2026-10-20 · COMPLETED'),
          findsOneWidget);
      expect(find.text('#TEST27 · $status'), findsOneWidget);
      expect(h.orderRoutes.every((id) => id == 11), isTrue);
      expect(h.gps.tracking.last.active, isFalse);
      await tester.pump(const Duration(seconds: 1));
      expect(h.routeLoads, loads + 1);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('Returning from sync refreshes route and orders once',
      (tester) async {
    final h = _Harness();
    await h.mount(tester);
    final loads = h.routeLoads;
    await tester.tap(find.byIcon(Icons.sync));
    await tester.pumpAndSettle();
    expect(find.byType(SyncPage), findsOneWidget);
    expect(h.routeLoads, loads);
    h.complete('DELIVERED');
    h.router.pop();
    await tester.pumpAndSettle();
    expect(h.routeLoads, loads + 1);
    expect(find.textContaining('Ruta #11 · 2026-10-20 · COMPLETED'),
        findsOneWidget);
    expect(find.text('#TEST27 · DELIVERED'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Sync confirmation refreshes route without notification loop',
      (tester) async {
    final h = _Harness();
    await h.mount(tester);
    final loads = h.routeLoads;
    h.complete('DELIVERED');
    h.sync.confirmedCount++;
    await h.sync.reload();
    await tester.pumpAndSettle();
    expect(h.routeLoads, loads + 1);
    expect(find.textContaining('Ruta #11 · 2026-10-20 · COMPLETED'),
        findsOneWidget);
    expect(find.text('#TEST27 · DELIVERED'), findsOneWidget);
    await h.sync.reload();
    await tester.pumpAndSettle();
    expect(h.routeLoads, loads + 1);
    expect(tester.takeException(), isNull);
  });

  for (final location in ['/orders/27', '/sync']) {
    testWidgets('Disposed routes page skips refresh after $location returns',
        (tester) async {
      final h = _Harness();
      await h.mount(tester);
      final loads = h.routeLoads;
      await tester.tap(location == '/sync'
          ? find.byIcon(Icons.sync)
          : find.text('#TEST27 · IN_TRANSIT'));
      await tester.pumpAndSettle();
      h.router.go('/away');
      await tester.pumpAndSettle();
      h.sync.confirmedCount++;
      await h.sync.reload();
      await tester.pumpAndSettle();
      expect(find.text('Otra página'), findsOneWidget);
      expect(h.routeLoads, loads);
      expect(tester.takeException(), isNull);
    });
  }
}
