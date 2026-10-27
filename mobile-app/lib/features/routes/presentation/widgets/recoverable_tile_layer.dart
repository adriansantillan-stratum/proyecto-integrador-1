import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import '../../../../core/network/map_tiles.dart';

/// A basemap failure must not hide the independent OSRM route and stop markers.
/// A retry resets/evicts failed images, without reloading routes or sending POD.
class RecoverableTileLayer extends StatefulWidget {
  final TileProvider Function()? tileProviderFactory;
  final String urlTemplate;

  const RecoverableTileLayer({
    super.key,
    this.tileProviderFactory,
    this.urlTemplate = CachedMapTileProvider.urlTemplate,
  });

  @override
  State<RecoverableTileLayer> createState() => _RecoverableTileLayerState();
}

class _RecoverableTileLayerState extends State<RecoverableTileLayer>
    with WidgetsBindingObserver {
  late TileProvider _provider;
  int _generation = 0;
  bool _failed = false;
  bool _errorScheduled = false;

  @override
  void initState() {
    super.initState();
    _provider = widget.tileProviderFactory?.call() ?? CachedMapTileProvider();
    WidgetsBinding.instance.addObserver(this);
  }

  void _reportError(int generation) {
    if (_failed || _errorScheduled) return;
    _errorScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _errorScheduled = false;
      if (mounted && generation == _generation) {
        setState(() => _failed = true);
      }
    });
  }

  void _retry() {
    setState(() {
      _failed = false;
      _generation++;
      _provider = widget.tileProviderFactory?.call() ?? CachedMapTileProvider();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _failed) _retry();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    // TileLayer owns the provider and disposes it.
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final generation = _generation;
    return Stack(children: [
      TileLayer(
        key: ValueKey(generation),
        urlTemplate: widget.urlTemplate,
        tileProvider: _provider,
        evictErrorTileStrategy: EvictErrorTileStrategy.dispose,
        // Request only the current viewport, with no speculative pan buffer.
        panBuffer: 0,
        errorTileCallback: (_, __, ___) => _reportError(generation),
      ),
      if (_failed)
        Align(
          alignment: Alignment.topCenter,
          child: Material(
            color: Theme.of(context).colorScheme.surface,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(children: [
                const Expanded(
                  child: Text('Mapa base incompleto. Revise la conexión.',
                      style: TextStyle(fontSize: 12)),
                ),
                TextButton(
                    onPressed: _retry, child: const Text('Reintentar mapa')),
              ]),
            ),
          ),
        ),
    ]);
  }
}

/// Visible at all times, including narrow screens and enlarged text settings.
class MapAttribution extends StatelessWidget {
  const MapAttribution({super.key});

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.bottomRight,
        child: ColoredBox(
          color: Theme.of(context).colorScheme.surface,
          child: const Padding(
            padding: EdgeInsets.all(3),
            child: Text('© ${CachedMapTileProvider.attribution}',
                textAlign: TextAlign.end, style: TextStyle(fontSize: 10)),
          ),
        ),
      );
}
