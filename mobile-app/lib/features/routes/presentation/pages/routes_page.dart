import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/sync/proof_sync.dart';
import '../../../../core/utils/polyline_decoder.dart';
import '../../../../core/utils/valid_coordinates.dart';
import '../../../../core/utils/path_throttle.dart';
import '../../../../core/cache/local_cache.dart';
import '../widgets/recoverable_tile_layer.dart';
import '../../data/datasources/route_remote_data_source.dart';
import '../../data/models/route_path_model.dart';
import '../../domain/entities/route.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../auth/presentation/bloc/auth_event.dart';
import '../../../auth/presentation/bloc/auth_state.dart';
import '../../../orders/domain/entities/order.dart';
import '../../../gps/presentation/bloc/gps_bloc.dart';
import '../bloc/route_bloc.dart';
import '../bloc/route_event.dart';
import '../bloc/route_state.dart';
import '../../../orders/presentation/bloc/order_bloc.dart';
import '../../../orders/presentation/bloc/order_event.dart';
import '../../../orders/presentation/bloc/order_state.dart';

class RoutesPage extends StatefulWidget {
  const RoutesPage({super.key});
  @override
  State<RoutesPage> createState() => _RoutesPageState();
}

class _RoutesPageState extends State<RoutesPage> {
  RouteEntity? _selected;
  Map<String, dynamic>? _review;
  String? _reviewError;
  bool _accepting = false;
  bool _pathBusy = false;
  RoutePathModel? _path;
  String? _pathError;
  final PathThrottle _throttle = PathThrottle();
  Timer? _timer;
  int _revision = 0;
  int _confirmed = 0;
  int? _preferredRoute;
  final MapController _map = MapController();

  @override
  void initState() {
    super.initState();
    context.read<GpsBloc>().add(AskGpsPermissions());
    unawaited(_restoreSelection());
    _confirmed = sl<ProofSync>().confirmedCount;
    sl<ProofSync>().addListener(_syncChanged);
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _fetchPath());
  }

  Future<void> _restoreSelection() async {
    final cache = sl<LocalCache>();
    try {
      _preferredRoute =
          await cache.read(cache.requireAccount(), 'selected_route') as int?;
    } catch (_) {
      /* Optional preference; explicit selection remains available. */
    }
    if (!mounted) return;
    final state = context.read<RouteBloc>().state;
    if (state is RouteLoaded) {
      _chooseFrom(state.routes);
    } else {
      _loadRoutes();
    }
  }

  void _syncChanged() {
    if (!mounted) return;
    final sync = sl<ProofSync>();
    if (sync.confirmedCount != _confirmed) {
      _confirmed = sync.confirmedCount;
      _loadRoutes();
    }
  }

  Future<void> _openAndRefresh(String location, {Object? extra}) async {
    await context.push<void>(location, extra: extra);
    if (!mounted) return;
    _loadRoutes();
  }

  void _loadRoutes() {
    final auth = context.read<AuthBloc>().state;
    if (auth is Authenticated) {
      final id = int.tryParse(auth.user.id);
      if (id != null) context.read<RouteBloc>().add(LoadRoutesEvent(id));
    }
  }

  void _chooseFrom(List<RouteEntity> routes) {
    final available = routes
        .where((r) => !['COMPLETED', 'CANCELLED'].contains(r.status))
        .toList();
    RouteEntity? selected;
    for (final r in routes) {
      if (r.id == (_selected?.id ?? _preferredRoute)) selected = r;
    }
    selected ??= available.length == 1 ? available.first : null;
    _choose(selected);
  }

  void _choose(RouteEntity? route) {
    setState(() {
      _selected = route;
      _path = null;
      _pathError = null;
      _review = null;
      _reviewError = null;
      _revision++;
      _pathBusy = false;
    });
    _throttle.reset();
    if (route == null) {
      context.read<GpsBloc>().add(const RouteTrackingChanged(0, 0, false));
      return;
    }
    _preferredRoute = route.id;
    final cache = sl<LocalCache>();
    unawaited(cache
        .write(cache.requireAccount(), 'selected_route', route.id)
        .catchError((Object _) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
                'No se pudo guardar la selección. Elija la ruta al reabrir.')));
      }
    }));
    context.read<GpsBloc>().add(RouteTrackingChanged(
        route.driverId, route.vehicleId, route.status == 'IN_PROGRESS'));
    context.read<OrderBloc>().add(LoadOrdersByRouteEvent(route.id));
    unawaited(_loadReview(route.id));
  }

  Future<void> _loadReview(int id) async {
    final revision = _revision;
    try {
      final result = await sl<RouteRemoteDataSource>().review(id);
      if (mounted && revision == _revision) {
        setState(() {
          _review = result;
          _reviewError = null;
        });
      }
    } catch (_) {
      if (mounted && revision == _revision) {
        setState(() => _reviewError =
            'No se pudo consultar aprobación y aceptación. Reintente con conexión.');
      }
    }
  }

  Future<void> _accept() async {
    final route = _selected;
    if (route == null) return;
    setState(() => _accepting = true);
    try {
      await sl<RouteRemoteDataSource>().accept(route.id);
      if (!mounted || _selected?.id != route.id) return;
      await _loadReview(route.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Hoja de ruta aceptada por el servidor')));
      _loadRoutes();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('No se pudo aceptar la hoja de ruta: $e')));
      }
    } finally {
      if (mounted) setState(() => _accepting = false);
    }
  }

  LatLng? get _position {
    final p = context.read<GpsBloc>().state.lastKnownPosition;
    return p != null &&
            validCoordinates(p.latitude, p.longitude) &&
            DateTime.now().difference(p.timestamp).abs() <=
                const Duration(minutes: 2)
        ? LatLng(p.latitude, p.longitude)
        : null;
  }

  List<OrderEntity> get _orders => context
      .read<OrderBloc>()
      .state
      .orders
      .where((o) => o.routeId == _selected?.id)
      .toList();
  List<OrderEntity> _sequence(List<OrderEntity> orders) {
    final active = orders.where((o) => !o.terminal).toList();
    final byId = {for (final o in active) o.id: o};
    final result = <OrderEntity>[];
    for (final id in _path?.orderedOrderIds ?? <int>[]) {
      final order = byId.remove(id);
      if (order != null) result.add(order);
    }
    // Local nearest-neighbor fallback; missing coordinates remain visible in list.
    var current = result.isNotEmpty &&
            validCoordinates(result.last.latitude, result.last.longitude)
        ? LatLng(result.last.latitude!, result.last.longitude!)
        : _position;
    while (byId.isNotEmpty) {
      final candidates = byId.values.toList();
      if (current != null) {
        final start = current;
        candidates.sort((a, b) {
          double distance(OrderEntity o) =>
              validCoordinates(o.latitude, o.longitude)
                  ? const Distance()(start, LatLng(o.latitude!, o.longitude!))
                  : double.infinity;
          return distance(a).compareTo(distance(b));
        });
      }
      final next = candidates.first;
      result.add(next);
      byId.remove(next.id);
      if (validCoordinates(next.latitude, next.longitude)) {
        current = LatLng(next.latitude!, next.longitude!);
      }
    }
    return [...result, ...orders.where((o) => o.terminal)];
  }

  Future<void> _fetchPath() async {
    final selected = _selected;
    if (!mounted || selected == null || _pathBusy) return;
    final active = _orders.where((o) => !o.terminal).toList();
    if (active.isEmpty) {
      if (_path != null) setState(() => _path = null);
      return;
    }
    final p = _position;
    final key =
        '${selected.id}:${active.map((o) => '${o.id}-${o.status}').join(',')}';
    if (!_throttle.allow(key, p?.latitude, p?.longitude, DateTime.now())) {
      return;
    }
    final revision = _revision;
    _pathBusy = true;
    try {
      final path = await sl<RouteRemoteDataSource>().getRoutePath(selected.id,
          fromLat: p?.latitude, fromLng: p?.longitude);
      // Decode here so malformed geometry also produces the labeled fallback.
      if (path.polyline != null) decodePolyline5(path.polyline!);
      if (!mounted || revision != _revision) return;
      setState(() {
        _path = path;
        _pathError = null;
      });
    } catch (_) {
      if (!mounted || revision != _revision) return;
      setState(() {
        _path = null;
        _pathError = 'No se obtuvo recorrido por calles';
      });
      // Allow a later retry, still driven by the 15-second timer.
      _throttle.failed();
    } finally {
      if (revision == _revision) _pathBusy = false;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    sl<ProofSync>().removeListener(_syncChanged);
    _map.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Mis rutas'), actions: [
          IconButton(
              tooltip: 'Actualizar rutas',
              onPressed: _loadRoutes,
              icon: const Icon(Icons.refresh)),
          ListenableBuilder(
              listenable: sl<ProofSync>(),
              builder: (context, _) => TextButton.icon(
                  style: TextButton.styleFrom(
                      foregroundColor:
                          Theme.of(context).appBarTheme.foregroundColor),
                  onPressed: () => _openAndRefresh('/sync'),
                  icon: const Icon(Icons.sync),
                  label: Text('${sl<ProofSync>().count}'))),
          IconButton(
              tooltip: 'Historial',
              onPressed: () => context.push('/history'),
              icon: const Icon(Icons.history)),
          IconButton(
              tooltip: 'Perfil',
              onPressed: () => context.push('/profile'),
              icon: const Icon(Icons.person)),
          IconButton(
              tooltip: 'Cerrar sesión',
              onPressed: () => context.read<AuthBloc>().add(LogoutRequested()),
              icon: const Icon(Icons.logout)),
        ]),
        body: MultiBlocListener(
            listeners: [
              BlocListener<RouteBloc, RouteState>(listener: (context, state) {
                if (state is RouteLoaded) _chooseFrom(state.routes);
              }),
              BlocListener<OrderBloc, OrderState>(listener: (context, state) {
                if (state is OrderLoaded) {
                  setState(() {});
                  _fetchPath();
                }
              }),
              BlocListener<GpsBloc, GpsState>(listener: (context, state) {
                setState(() {});
                _fetchPath();
              }),
            ],
            child:
                BlocBuilder<RouteBloc, RouteState>(builder: (context, routes) {
              final available = routes is RouteLoaded
                  ? routes.routes
                      .where((r) =>
                          r.id == _selected?.id ||
                          !['COMPLETED', 'CANCELLED'].contains(r.status))
                      .toList()
                  : <RouteEntity>[];
              return Column(children: [
                if (routes is RouteLoading) const LinearProgressIndicator(),
                if (routes is RouteError)
                  ListTile(
                      title: Text(routes.message),
                      trailing: IconButton(
                          onPressed: _loadRoutes,
                          icon: const Icon(Icons.refresh))),
                if (routes is RouteLoaded && available.isEmpty)
                  const Expanded(
                      child:
                          Center(child: Text('Sin rutas activas asignadas'))),
                if (available.isNotEmpty)
                  Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: DropdownButton<int>(
                        isExpanded: true,
                        value: available.any((r) => r.id == _selected?.id)
                            ? _selected?.id
                            : null,
                        hint: Text('${available.length} rutas disponibles'),
                        items: available
                            .map((r) => DropdownMenuItem(
                                value: r.id,
                                child: Text(
                                    'Ruta #${r.id} · ${r.routeDate} · ${r.status}')))
                            .toList(),
                        onChanged: (id) {
                          if (id != null) {
                            _choose(available.firstWhere((r) => r.id == id));
                          }
                        },
                      )),
                if (_selected != null) Expanded(child: _routeBody()),
              ]);
            })),
      );
  Widget _routeBody() =>
      BlocBuilder<OrderBloc, OrderState>(builder: (context, state) {
        final orders = _sequence(
            state.orders.where((o) => o.routeId == _selected!.id).toList());
        final active = orders.where((o) => !o.terminal).toList();
        final p = _position;
        final points = [
          if (p != null) p,
          ...active
              .where((o) => validCoordinates(o.latitude, o.longitude))
              .map((o) => LatLng(o.latitude!, o.longitude!))
        ];
        final streets = _path?.source == 'osrm' && _path?.polyline != null
            ? decodePolyline5(_path!.polyline!)
            : <LatLng>[];
        final gps = context.watch<GpsBloc>().state;
        final color = Theme.of(context).colorScheme;
        return Column(children: [
          ExpansionTile(
              title: Text(
                  'Hoja #${_selected!.id} · Vehículo #${_selected!.vehicleId}'),
              subtitle: Text(_selected!.cached
                  ? 'Datos guardados sin conexión'
                  : 'Aprobación y aceptación'),
              children: [
                SizedBox(
                    height: 220,
                    child: ListView(children: [
                      if (_reviewError != null)
                        ListTile(
                            title: Text(_reviewError!),
                            trailing: IconButton(
                                onPressed: () => _loadReview(_selected!.id),
                                icon: const Icon(Icons.refresh))),
                      if (_review != null)
                        ..._review!.entries.map((e) => ListTile(
                            dense: true,
                            title: Text(const {
                                  'routeId': 'Ruta',
                                  'approved': 'Aprobada',
                                  'accepted': 'Aceptada por conductor',
                                  'loadWeightKg': 'Carga (kg)',
                                  'approvedBy': 'Aprobó',
                                  'approvedAt': 'Fecha de aprobación',
                                  'acceptedBy': 'Aceptó',
                                  'acceptedAt': 'Fecha de aceptación',
                                  'note': 'Observaciones',
                                }[e.key] ??
                                e.key),
                            subtitle: Text(e.value is bool
                                ? (e.value == true ? 'Sí' : 'No')
                                : '${e.value ?? 'Sin registrar'}'))),
                      if (_review == null && _reviewError == null)
                        const LinearProgressIndicator(),
                      if (_selected!.status == 'PLANNED')
                        FilledButton(
                            onPressed: _accepting ||
                                    _review == null ||
                                    _review!['approved'] != true ||
                                    _review!['accepted'] == true
                                ? null
                                : _accept,
                            child: Text(_review?['accepted'] == true
                                ? 'Hoja de ruta aceptada'
                                : 'Aceptar hoja de ruta')),
                    ]))
              ]),
          if (gps.error.isNotEmpty)
            ListTile(
                dense: true,
                title: Text(gps.error),
                trailing: IconButton(
                    onPressed: () =>
                        context.read<GpsBloc>().add(AskGpsPermissions()),
                    icon: const Icon(Icons.my_location))),
          SizedBox(
              height: 185,
              child: FlutterMap(
                  key: ValueKey(_selected!.id),
                  mapController: _map,
                  options: MapOptions(
                      initialCenter: points.isEmpty
                          ? const LatLng(-12.0464, -77.0428)
                          : points.first,
                      initialZoom: 13),
                  children: [
                    const RecoverableTileLayer(),
                    PolylineLayer(polylines: [
                      Polyline(
                          points: streets.isEmpty ? points : streets,
                          strokeWidth: 4,
                          color:
                              streets.isEmpty ? color.tertiary : color.primary,
                          isDotted: streets.isEmpty)
                    ]),
                    MarkerLayer(markers: [
                      if (p != null)
                        Marker(
                            point: p,
                            child:
                                Icon(Icons.my_location, color: color.primary)),
                      ...active
                          .where(
                              (o) => validCoordinates(o.latitude, o.longitude))
                          .map((o) => Marker(
                              point: LatLng(o.latitude!, o.longitude!),
                              child: CircleAvatar(
                                  radius: 14,
                                  child: Text('${active.indexOf(o) + 1}')))),
                    ]),
                    const MapAttribution(),
                  ])),
          Padding(
              padding: const EdgeInsets.all(8),
              child: Text(streets.isNotEmpty
                  ? 'Por calles · ${_path!.distanceKm.toStringAsFixed(1)} km · ${_path!.durationMin > 0 ? '${_path!.durationMin.round()} min estimados' : 'ETA no disponible'}'
                  : '${_pathError ?? 'Recorrido aproximado en línea recta'} · ETA no disponible')),
          Text(
              'Ruta seleccionada: ${orders.length} pedidos · ${active.length} activos · '
              '${orders.where((o) => o.status == 'DELIVERED').length} entregados · '
              '${orders.where((o) => o.status == 'FAILED').length} fallidos · '
              '${orders.where((o) => o.status == 'RETURNED').length} devueltos'),
          if (state is OrderLoading) const LinearProgressIndicator(),
          if (state is OrderError)
            ListTile(
                title: Text(state.message),
                trailing: IconButton(
                    onPressed: () => context
                        .read<OrderBloc>()
                        .add(LoadOrdersByRouteEvent(_selected!.id)),
                    icon: const Icon(Icons.refresh))),
          if (orders.any((o) => o.cached))
            const Text(
                'Pedidos guardados sin conexión. Estados pendientes de verificar.'),
          Expanded(
              child: ListenableBuilder(
                  listenable: sl<ProofSync>(),
                  builder: (context, _) => ListView.builder(
                      itemCount: orders.length,
                      itemBuilder: (context, i) {
                        final o = orders[i];
                        final pending = sl<ProofSync>()
                            .items
                            .any((p) => p['orderId'] == o.id);
                        return ListTile(
                            leading: CircleAvatar(
                                child: Text(o.terminal
                                    ? '—'
                                    : '${active.indexOf(o) + 1}')),
                            title: Text('#${o.trackingNumber} · ${o.status}'),
                            subtitle: Text(
                                '${o.recipientName}\n${o.deliveryAddress}${pending ? '\nEvidencia pendiente de confirmación' : ''}'),
                            isThreeLine: true,
                            trailing: Icon(
                                pending ? Icons.sync : Icons.chevron_right),
                            onTap: () =>
                                _openAndRefresh('/orders/${o.id}', extra: (
                                  order: o,
                                  canOperate: _selected!.status == 'IN_PROGRESS'
                                )));
                      }))),
        ]);
      });
}
