import 'package:latlong2/latlong.dart';

/// Decodifica una geometría en formato polyline5 (Google Encoded Polyline,
/// precisión 1e-5), el formato que devuelve OSRM por defecto.
///
/// Algoritmo estándar: cada delta viene en grupos de 5 bits con offset 63
/// y bit de continuación; latitud y longitud se alternan como acumulados.
List<LatLng> decodePolyline5(String encoded) {
  final points = <LatLng>[];
  int index = 0;
  int lat = 0;
  int lng = 0;

  int readDelta() {
    int result = 0;
    int shift = 0;
    int b;
    do {
      b = encoded.codeUnitAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
  }

  while (index < encoded.length) {
    lat += readDelta();
    lng += readDelta();
    points.add(LatLng(lat / 1e5, lng / 1e5));
  }
  return points;
}
