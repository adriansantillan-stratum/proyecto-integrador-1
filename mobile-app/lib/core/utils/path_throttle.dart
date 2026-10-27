/// Coordinate changes are rounded to ~11 m; backend routing is capped to one
/// request per 15 seconds. Callers retain the latest position for a later retry.
class PathThrottle {
  String? _key;
  DateTime? _at;
  final Duration interval;
  PathThrottle({this.interval = const Duration(seconds: 15)});
  void reset() {
    _key = null;
    _at = null;
  }

  void failed() {
    _key = null;
  }

  bool allow(String stops, double? lat, double? lng, DateTime now) {
    final key = '$stops:${lat?.toStringAsFixed(4)},${lng?.toStringAsFixed(4)}';
    if (key == _key || (_at != null && now.difference(_at!) < interval)) {
      return false;
    }
    _key = key;
    _at = now;
    return true;
  }
}
