import 'package:get_it/get_it.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../network/auth_interceptor.dart';
import '../theme/theme_bloc.dart';
import '../cache/local_cache.dart';
import '../network/api_config.dart';
import '../network/session_refresh.dart';
import '../sync/proof_sync.dart';
import '../../features/auth/presentation/bloc/auth_event.dart';
import '../../features/auth/data/datasources/auth_local_data_source.dart';
import '../../features/auth/data/datasources/auth_remote_data_source.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/domain/usecases/login_usecase.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';

import '../../features/gps/data/datasources/gps_sensor_data_source.dart';
import '../../features/gps/data/repositories/gps_repository_impl.dart';
import '../../features/gps/domain/repositories/gps_repository.dart';
import '../../features/gps/presentation/bloc/gps_bloc.dart';

import '../../features/routes/data/datasources/route_remote_data_source.dart';
import '../../features/routes/data/repositories/route_repository_impl.dart';
import '../../features/routes/domain/repositories/route_repository.dart';
import '../../features/routes/domain/usecases/get_driver_routes.dart';
import '../../features/routes/presentation/bloc/route_bloc.dart';

import '../../features/orders/data/datasources/order_remote_data_source.dart';
import '../../features/orders/data/repositories/order_repository_impl.dart';
import '../../features/orders/domain/repositories/order_repository.dart';
import '../../features/orders/domain/usecases/get_orders_by_route.dart';
import '../../features/orders/domain/usecases/update_order_status.dart';
import '../../features/orders/presentation/bloc/order_bloc.dart';

import '../../features/history/data/datasources/history_remote_data_source.dart';
import '../../features/history/data/repositories/history_repository_impl.dart';
import '../../features/history/domain/repositories/history_repository.dart';
import '../../features/history/presentation/bloc/history_bloc.dart';

final sl = GetIt.instance; // sl = Service Locator

Future<void> init() async {
  // --- Core ---
  sl.registerLazySingleton(() => const FlutterSecureStorage(
        aOptions: AndroidOptions(encryptedSharedPreferences: true),
        iOptions: IOSOptions(
            accessibility: KeychainAccessibility.unlocked_this_device),
      ));

  sl.registerLazySingleton(() {
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.backendUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
      ),
    );
    dio.interceptors.add(AuthInterceptor(
        localDataSource: sl(),
        refresh: sl(),
        client: dio,
        onExpired: () => sl<AuthBloc>().add(LogoutRequested())));
    return dio;
  });

  // Cliente dedicado para Auth
  sl.registerLazySingleton(
      () => Dio(BaseOptions(
            baseUrl: ApiConfig.identityUrl,
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 10),
          )),
      instanceName: 'authClient');

  // --- Core: Local Cache ---
  sl.registerLazySingleton(() => LocalCache(storage: sl()));
  sl.registerLazySingleton(() =>
      SessionRefresh(client: sl(instanceName: 'authClient'), local: sl()));
  sl.registerLazySingleton(() => ProofSync(cache: sl(), client: sl()));

  // --- Core: Theme ---
  sl.registerFactory(() => ThemeBloc());

  // --- Features: Auth ---
  sl.registerLazySingleton<AuthRemoteDataSource>(() => AuthRemoteDataSourceImpl(
        client: sl(instanceName: 'authClient'),
        apiClient: sl(),
      ));
  sl.registerLazySingleton<AuthLocalDataSource>(
      () => AuthLocalDataSourceImpl(secureStorage: sl()));
  sl.registerLazySingleton<AuthRepository>(() => AuthRepositoryImpl(
        remoteDataSource: sl(),
        localDataSource: sl(),
        cache: sl(),
        sync: sl(),
        refresh: sl(),
      ));
  sl.registerLazySingleton(() => LoginUseCase(sl()));
  sl.registerLazySingleton(() => AuthBloc(
        loginUseCase: sl(),
        authRepository: sl(),
      ));

  // --- Features: GPS ---
  sl.registerLazySingleton<GpsSensorDataSource>(
      () => GpsSensorDataSourceImpl());
  sl.registerLazySingleton<GpsRepository>(() => GpsRepositoryImpl(
        sensorDataSource: sl(),
        apiClient: sl(),
      ));
  sl.registerFactory(() => GpsBloc(gpsRepository: sl()));

  // --- Features: Routes ---
  sl.registerLazySingleton<RouteRemoteDataSource>(
      () => RouteRemoteDataSourceImpl(client: sl(), cache: sl()));
  sl.registerLazySingleton<RouteRepository>(
      () => RouteRepositoryImpl(remoteDataSource: sl()));
  sl.registerLazySingleton(() => GetDriverRoutesUseCase(sl()));
  sl.registerFactory(() => RouteBloc(getDriverRoutes: sl()));

  // --- Features: Orders ---
  sl.registerLazySingleton<OrderRemoteDataSource>(
      () => OrderRemoteDataSourceImpl(client: sl()));
  sl.registerLazySingleton<OrderRepository>(() =>
      OrderRepositoryImpl(remoteDataSource: sl(), cache: sl(), sync: sl()));
  sl.registerLazySingleton(() => GetOrdersByRouteUseCase(sl()));
  sl.registerLazySingleton(() => UpdateOrderStatusUseCase(sl()));
  sl.registerFactory(() => OrderBloc(
        getOrdersByRoute: sl(),
        updateOrderStatus: sl(),
      ));

  // --- Features: History ---
  sl.registerLazySingleton<HistoryRemoteDataSource>(() =>
      HistoryRemoteDataSourceImpl(client: sl(), cache: sl(), local: sl()));
  sl.registerLazySingleton<HistoryRepository>(
      () => HistoryRepositoryImpl(remoteDataSource: sl()));
  sl.registerFactory(() => HistoryBloc(historyRepository: sl()));
}
