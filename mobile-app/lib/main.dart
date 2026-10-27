import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'core/di/injection_container.dart' as di;
import 'core/theme/app_theme.dart';
import 'core/theme/theme_bloc.dart';
import 'core/router/app_router.dart';
import 'core/sync/proof_sync.dart';
import 'features/gps/presentation/bloc/gps_bloc.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/auth/presentation/bloc/auth_event.dart';
import 'features/auth/presentation/bloc/auth_state.dart';
import 'features/routes/presentation/bloc/route_bloc.dart';
import 'features/orders/presentation/bloc/order_bloc.dart';
import 'features/history/presentation/bloc/history_bloc.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await di.init();
  di.sl<ProofSync>().start();
  runApp(const EcoRouteApp());
}

class EcoRouteApp extends StatefulWidget {
  const EcoRouteApp({super.key});
  @override
  State<EcoRouteApp> createState() => _EcoRouteAppState();
}

class _EcoRouteAppState extends State<EcoRouteApp> {
  late final AuthBloc _auth = di.sl<AuthBloc>()..add(CheckAuthStatusEvent());
  late final GoRouter _router = createAppRouter(_auth);
  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MultiBlocProvider(
        providers: [
          BlocProvider.value(value: _auth),
          BlocProvider(create: (_) => di.sl<ThemeBloc>()),
        ],
        child: BlocBuilder<AuthBloc, AuthState>(builder: (context, auth) {
          final account =
              auth is Authenticated ? auth.user.subject : 'signed-out';
          // Dispose in-memory routes/orders/history/GPS on logout or account switch.
          return KeyedSubtree(
              key: ValueKey(account),
              child: MultiBlocProvider(
                providers: [
                  BlocProvider(create: (_) => di.sl<GpsBloc>()),
                  BlocProvider(create: (_) => di.sl<RouteBloc>()),
                  BlocProvider(create: (_) => di.sl<OrderBloc>()),
                  BlocProvider(create: (_) => di.sl<HistoryBloc>()),
                ],
                child: BlocBuilder<ThemeBloc, ThemeState>(
                    builder: (context, theme) => MaterialApp.router(
                        title: 'EcoRoute Driver',
                        debugShowCheckedModeBanner: false,
                        theme: AppTheme.lightTheme,
                        darkTheme: AppTheme.darkTheme,
                        themeMode: theme.themeMode,
                        routerConfig: _router)),
              ));
        }),
      );
}
