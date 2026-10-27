import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:ecoroute_driver_app/core/network/map_tiles.dart';
import 'package:ecoroute_driver_app/features/routes/presentation/widgets/recoverable_tile_layer.dart';

class _Tiles extends TileProvider {
  bool fail = true;
  int requests = 0;
  final image = MemoryImage(base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='));

  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) {
    requests++;
    // flutter_test intercepts HTTP and returns 400. No external service is used.
    if (fail) return NetworkImage('https://map.invalid/${coordinates.key}');
    return image;
  }
}

Widget _map(_Tiles tiles) => MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 390,
          height: 260,
          child: FlutterMap(
            options: const MapOptions(
                initialCenter: LatLng(-12.0464, -77.0428), initialZoom: 13),
            children: [
              RecoverableTileLayer(tileProviderFactory: () => tiles),
              PolylineLayer(polylines: [
                Polyline(points: const [
                  LatLng(-12.0464, -77.0428),
                  LatLng(-12.0525, -77.0347)
                ], color: Colors.green, strokeWidth: 4)
              ]),
              const MapAttribution(),
            ],
          ),
        ),
      ),
    );

void main() {
  test('native provider identifies EcoRoute and caches the exact viewed tile',
      () {
    final provider = CachedMapTileProvider();
    final image = provider.getImage(const TileCoordinates(2342, 4372, 13),
        TileLayer(urlTemplate: CachedMapTileProvider.urlTemplate));
    expect(provider.headers['User-Agent'], contains('EcoRoute/1.0'));
    expect(image, isA<CachedNetworkImageProvider>());
    final cached = image as CachedNetworkImageProvider;
    expect(cached.url, 'https://tile.openstreetmap.org/13/2342/4372.png');
    expect(cached.headers?['User-Agent'], provider.headers['User-Agent']);
    provider.dispose();
  });

  testWidgets('failed basemap is explicit; retry preserves the route layer',
      (tester) async {
    final tiles = _Tiles();
    await tester.pumpWidget(_map(tiles));
    await tester.pumpAndSettle();
    expect(
        find.text('Mapa base incompleto. Revise la conexión.'), findsOneWidget);
    expect(find.byType(PolylineLayer), findsOneWidget);
    expect(find.text('© OpenStreetMap contributors'), findsOneWidget);
    final before = tiles.requests;
    tiles.fail = false;
    await tester.tap(find.text('Reintentar mapa'));
    await tester.pumpAndSettle();
    expect(tiles.requests, greaterThan(before));
    expect(
        find.text('Mapa base incompleto. Revise la conexión.'), findsNothing);
    expect(find.byType(PolylineLayer), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('resume retries an errored basemap without recreating the app',
      (tester) async {
    final tiles = _Tiles();
    await tester.pumpWidget(_map(tiles));
    await tester.pumpAndSettle();
    final before = tiles.requests;
    expect(find.text('Reintentar mapa'), findsOneWidget);
    tiles.fail = false;
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(tiles.requests, greaterThan(before));
    expect(find.text('Reintentar mapa'), findsNothing);
    expect(find.byType(PolylineLayer), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
