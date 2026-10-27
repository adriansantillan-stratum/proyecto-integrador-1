import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:ecoroute_driver_app/core/cache/local_cache.dart';
import 'package:ecoroute_driver_app/core/di/injection_container.dart';
import 'package:ecoroute_driver_app/core/network/auth_interceptor.dart';
import 'package:ecoroute_driver_app/core/network/session_refresh.dart';
import 'package:ecoroute_driver_app/core/router/app_router.dart';
import 'package:ecoroute_driver_app/core/sync/proof_sync.dart';
import 'package:ecoroute_driver_app/core/sync/sync_page.dart';
import 'package:ecoroute_driver_app/core/theme/app_theme.dart';
import 'package:ecoroute_driver_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:ecoroute_driver_app/features/auth/domain/usecases/login_usecase.dart';
import 'package:ecoroute_driver_app/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:ecoroute_driver_app/features/auth/presentation/bloc/auth_event.dart';
import 'package:ecoroute_driver_app/features/auth/presentation/bloc/auth_state.dart';
import 'package:ecoroute_driver_app/features/auth/presentation/pages/login_page.dart';
import 'package:ecoroute_driver_app/features/gps/presentation/bloc/gps_bloc.dart';
import 'package:ecoroute_driver_app/features/history/data/datasources/history_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/history/data/repositories/history_repository_impl.dart';
import 'package:ecoroute_driver_app/features/history/presentation/bloc/history_bloc.dart';
import 'package:ecoroute_driver_app/features/history/presentation/bloc/history_state.dart';
import 'package:ecoroute_driver_app/features/history/presentation/pages/history_page.dart';
import 'package:ecoroute_driver_app/features/orders/data/datasources/order_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/orders/data/repositories/order_repository_impl.dart';
import 'package:ecoroute_driver_app/features/orders/domain/usecases/get_orders_by_route.dart';
import 'package:ecoroute_driver_app/features/orders/domain/usecases/update_order_status.dart';
import 'package:ecoroute_driver_app/features/orders/presentation/bloc/order_bloc.dart';
import 'package:ecoroute_driver_app/features/routes/data/datasources/route_remote_data_source.dart';
import 'package:ecoroute_driver_app/features/routes/data/repositories/route_repository_impl.dart';
import 'package:ecoroute_driver_app/features/routes/domain/usecases/get_driver_routes.dart';
import 'package:ecoroute_driver_app/features/routes/presentation/bloc/route_bloc.dart';
import 'package:ecoroute_driver_app/features/routes/presentation/pages/routes_page.dart';
import 'fakes.dart';
import 'session_navigation_support.dart';

class _Gps extends Cubit<GpsState> implements GpsBloc {
  _Gps() : super(const GpsState());
  @override
  void add(GpsEvent event) {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Actual AuthBloc/repository/interceptor/router/pages, simulated HTTP and GPS.
class _SessionApp {
  final local = MemorySession(user());
  final cache = LocalCache(storage: const FlutterSecureStorage());
  final gps = _Gps();
  final calls = <String>[];
  final states = <AuthState>[];
  int historyStatus = 200;
  int identityStatus = 200;
  bool rejectOldAccess = false;
  int renewals = 0;
  int revocations = 0;
  int expirations = 0;
  late final Dio api;
  late final Dio identity;
  late final ProofSync sync;
  late final AuthBloc auth;
  late final RouteBloc routes;
  late final OrderBloc orders;
  late final HistoryBloc history;
  late final GoRouter router;

  _SessionApp() {
    api = Dio(BaseOptions(baseUrl: 'http://test.invalid'))
      ..httpClientAdapter = SessionNavigationAdapter((request) {
        calls.add('${request.method} ${request.path}');
        if (request.path == '/routes') return sessionResponse([]);
        if (request.path == '/orders') {
          if (rejectOldAccess &&
              request.headers['Authorization'] == 'Bearer old') {
            return sessionResponse({}, 401);
          }
          return sessionResponse(historyStatus == 200 ? [] : {}, historyStatus);
        }
        throw StateError('Unexpected fake API endpoint: ${request.path}');
      });
    identity = Dio(BaseOptions(baseUrl: 'http://identity.invalid'))
      ..httpClientAdapter = SessionNavigationAdapter((request) {
        if (request.path.endsWith('/logout')) {
          revocations++;
          return sessionResponse({});
        }
        if (request.path.endsWith('/token')) {
          renewals++;
          return sessionResponse(
              {'access_token': 'new', 'refresh_token': 'rotated'},
              identityStatus);
        }
        throw StateError('Unexpected fake identity endpoint: ${request.path}');
      });
    final refresh = SessionRefresh(client: identity, local: local);
    api.interceptors.add(AuthInterceptor(
        localDataSource: local,
        refresh: refresh,
        client: api,
        onExpired: () {
          expirations++;
          auth.add(LogoutRequested());
        }));
    sync = ProofSync(cache: cache, client: api);
    final repo = AuthRepositoryImpl(
        remoteDataSource:
            AuthRemoteDataSourceImpl(client: identity, apiClient: api),
        localDataSource: local,
        cache: cache,
        sync: sync,
        refresh: refresh);
    auth = AuthBloc(loginUseCase: LoginUseCase(repo), authRepository: repo);
    final source = RouteRemoteDataSourceImpl(client: api, cache: cache);
    routes = RouteBloc(
        getDriverRoutes: GetDriverRoutesUseCase(
            RouteRepositoryImpl(remoteDataSource: source)));
    final orderRepo = OrderRepositoryImpl(
        remoteDataSource: OrderRemoteDataSourceImpl(client: api),
        cache: cache,
        sync: sync);
    orders = OrderBloc(
        getOrdersByRoute: GetOrdersByRouteUseCase(orderRepo),
        updateOrderStatus: UpdateOrderStatusUseCase(orderRepo));
    history = HistoryBloc(
        historyRepository: HistoryRepositoryImpl(
            remoteDataSource: HistoryRemoteDataSourceImpl(
                client: api, cache: cache, local: local)));
    sl.registerSingleton<LocalCache>(cache);
    sl.registerSingleton<ProofSync>(sync);
    sl.registerSingleton<RouteRemoteDataSource>(source);
    router = createAppRouter(auth);
  }

  // push() keeps the root URI in go_router 13; inspect the visible top match.
  String get location =>
      router.routerDelegate.currentConfiguration.last.matchedLocation;

  Future<void> mount(WidgetTester tester) async {
    final subscription = auth.stream.listen(states.add);
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1;
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox.shrink());
      router.dispose();
      await subscription.cancel();
      await auth.close();
      await routes.close();
      await orders.close();
      await history.close();
      await gps.close();
      sync.dispose();
      api.close();
      identity.close();
      await sl.reset();
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    await tester.pumpWidget(MultiBlocProvider(
        providers: [
          BlocProvider<AuthBloc>.value(value: auth),
          BlocProvider<RouteBloc>.value(value: routes),
          BlocProvider<OrderBloc>.value(value: orders),
          BlocProvider<HistoryBloc>.value(value: history),
          BlocProvider<GpsBloc>.value(value: gps),
        ],
        child: MaterialApp.router(
            theme: AppTheme.lightTheme, routerConfig: router)));
    auth.add(CheckAuthStatusEvent());
    await tester.pumpAndSettle();
    expect(location, '/routes');
    expect(auth.state, isA<Authenticated>());
    states.clear();
  }

  Future<void> syncBack(WidgetTester tester) async {
    await tester.tap(find.byIcon(Icons.sync));
    await tester.pumpAndSettle();
    expect(find.byType(SyncPage), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byType(RoutesPage), findsOneWidget);
  }

  void expectSession(WidgetTester tester) {
    expect(auth.state, isA<Authenticated>());
    expect(states, isEmpty);
    expect(local.value?.subject, 'account-a');
    expect(cache.account, 'account-a');
    expect(expirations, 0);
    expect(revocations, 0);
    expect(find.byType(LoginPage), findsNothing);
    expect(tester.takeException(), isNull);
  }
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  for (final delay in [0, 16, 100, 300, 500]) {
    testWidgets('Saved History center tapped ${delay}ms after Sync Back',
        (tester) async {
      final app = _SessionApp();
      await app.mount(tester);
      final historyCenter = tester.getCenter(find.byTooltip('Historial'));
      await tester.tap(find.byIcon(Icons.sync));
      await tester.pumpAndSettle();
      expect(find.byType(SyncPage), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pump(); // Start the reverse animation at virtual time zero.
      if (delay > 0) await tester.pump(Duration(milliseconds: delay));
      final movingLogout = tester.getRect(find.byTooltip('Cerrar sesión'));
      // Deliberately replay geometry measured before opening Sync.
      await tester.tapAt(historyCenter);
      await tester.pumpAndSettle();
      debugPrint('Saved History center after ${delay}ms: ${app.location}; '
          'expirations=${app.expirations}; revocations=${app.revocations}; '
          'savedCenter=$historyCenter; movingLogout=$movingLogout');
      if (delay == 100) {
        // Characterize the automation hazard, not an involuntary auth failure:
        // the moving logout button receives the stale History coordinate.
        expect(movingLogout.contains(historyCenter), isTrue);
        expect(app.location, '/login');
        expect(app.auth.state, isA<Unauthenticated>());
        expect(app.states.map((state) => state.runtimeType),
            [AuthLoading, Unauthenticated]);
        expect(app.renewals, 0);
        expect(app.expirations, 0);
        expect(app.revocations, 1);
        expect(app.local.value, isNull);
        expect(tester.takeException(), isNull);
      } else {
        expect(app.location, delay >= 300 ? '/history' : '/routes');
        app.expectSession(tester);
      }
    });
  }

  testWidgets('Sync Back History with current target keeps actual session',
      (tester) async {
    final app = _SessionApp();
    await app.mount(tester);
    for (var i = 0; i < 3; i++) {
      await app.syncBack(tester);
      await tester.tap(find.byTooltip('Historial'));
      await tester.pumpAndSettle();
      expect(app.location, '/history');
      expect(find.byType(HistoryPage), findsOneWidget);
      expect(app.history.state, isA<HistoryLoaded>());
      app.expectSession(tester);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
    }
    expect(app.calls.where((c) => c == 'GET /orders').length, 3);
    expect(app.renewals, 0);
  });

  for (final status in [200, 400, 500]) {
    testWidgets('History after Sync Back and renewed token returns API $status',
        (tester) async {
      final app = _SessionApp();
      await app.mount(tester);
      await app.syncBack(tester);
      app.rejectOldAccess = true;
      app.historyStatus = status;
      await tester.tap(find.byTooltip('Historial'));
      await tester.pumpAndSettle();
      expect(app.location, '/history');
      expect(app.history.state,
          status == 200 ? isA<HistoryLoaded>() : isA<HistoryError>());
      expect(app.renewals, 1);
      expect(app.local.value?.token, 'new');
      app.expectSession(tester);
    });
  }

  testWidgets('Refresh invalid_grant actually logs out through AuthBloc/router',
      (tester) async {
    final app = _SessionApp();
    await app.mount(tester);
    await app.syncBack(tester);
    app.rejectOldAccess = true;
    app.identityStatus = 400;
    await tester.tap(find.byTooltip('Historial'));
    await tester.pumpAndSettle();
    expect(app.location, '/login');
    expect(app.auth.state, isA<Unauthenticated>());
    expect(app.states.map((state) => state.runtimeType),
        [AuthLoading, Unauthenticated]);
    expect(app.expirations, 1);
    expect(app.renewals, 1);
    expect(app.revocations, 1);
    expect(app.local.value, isNull);
    expect(app.cache.account, isNull);
    expect(find.byType(LoginPage), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Explicit logout button produces login even without HTTP failure',
      (tester) async {
    final app = _SessionApp();
    await app.mount(tester);
    await app.syncBack(tester);
    await tester.tap(find.byTooltip('Cerrar sesión'));
    await tester.pumpAndSettle();
    expect(app.location, '/login');
    expect(app.auth.state, isA<Unauthenticated>());
    expect(app.expirations, 0);
    expect(app.renewals, 0);
    expect(app.revocations, 1);
    expect(app.local.value, isNull);
    expect(tester.takeException(), isNull);
  });
}
