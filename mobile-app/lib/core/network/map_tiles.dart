import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_map/flutter_map.dart';

/// Only tiles requested by the visible map are cached. No area downloads.
/// CachedNetworkImage honours HTTP Cache-Control/ETag through its cache manager
/// (seven days when no Cache-Control is supplied). Failed requests are not tiles.
class CachedMapTileProvider extends TileProvider {
  static const userAgent =
      'EcoRoute/1.0 (Android; com.example.ecoroute_driver_app)';
  static const urlTemplate = String.fromEnvironment('MAP_TILE_URL',
      defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  static const attribution = String.fromEnvironment('MAP_TILE_ATTRIBUTION',
      defaultValue: 'OpenStreetMap contributors');

  CachedMapTileProvider() : super(headers: {'User-Agent': userAgent});

  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) =>
      CachedNetworkImageProvider(getTileUrl(coordinates, options),
          headers: headers);
}
