import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/bloc/auth_state.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/routes/presentation/pages/routes_page.dart';
import '../../features/orders/presentation/pages/order_detail_page.dart';
import '../../features/orders/domain/entities/order.dart';
import '../../features/history/presentation/pages/history_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../sync/sync_page.dart';

GoRouter createAppRouter(AuthBloc authBloc) {
  return GoRouter(
    initialLocation: '/login',
    refreshListenable: GoRouterRefreshStream(authBloc.stream),
    redirect: (BuildContext context, GoRouterState state) {
      final authState = authBloc.state;
      final isAuthenticated = authState is Authenticated;
      final isLoggingIn = state.matchedLocation == '/login';

      if (!isAuthenticated && !isLoggingIn) {
        return '/login';
      }

      if (isAuthenticated && isLoggingIn) {
        return '/routes';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/sync', builder: (context, state) => const SyncPage()),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/routes',
        name: 'routes',
        builder: (context, state) => const RoutesPage(),
      ),
      GoRoute(
        path: '/orders/:id',
        name: 'orderDetail',
        builder: (context, state) {
          final args = state.extra;
          if (args is! ({OrderEntity order, bool canOperate}) ||
              state.pathParameters['id'] != args.order.id.toString()) {
            return Scaffold(
              appBar: AppBar(title: const Text('Pedido')),
              body: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                        'Enlace de pedido incompleto. Abra el pedido desde Mis rutas'),
                    FilledButton(
                      onPressed: () => context.go('/routes'),
                      child: const Text('Ir a Mis rutas'),
                    ),
                  ],
                ),
              ),
            );
          }
          return OrderDetailPage(
              order: args.order, canOperate: args.canOperate);
        },
      ),
      GoRoute(
        path: '/history',
        name: 'history',
        builder: (context, state) => const HistoryPage(),
      ),
      GoRoute(
        path: '/profile',
        name: 'profile',
        builder: (context, state) => const ProfilePage(),
      ),
    ],
  );
}

/// A ChangeNotifier that listens to a Stream and notifies GoRouter to refresh.
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) {
      notifyListeners();
    });
  }

  late final dynamic _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
