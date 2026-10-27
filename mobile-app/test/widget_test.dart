import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ecoroute_driver_app/core/cache/local_cache.dart';
import 'package:ecoroute_driver_app/core/di/injection_container.dart';
import 'package:ecoroute_driver_app/core/sync/proof_sync.dart';
import 'package:ecoroute_driver_app/core/sync/sync_page.dart';
import 'package:ecoroute_driver_app/core/theme/app_theme.dart';
import 'package:ecoroute_driver_app/features/orders/presentation/widgets/signature_pad.dart';
import 'fakes.dart';

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });
  tearDown(() async {
    await sl.reset();
  });
  testWidgets('Sync page shows pending and rejected without claiming delivery',
      (tester) async {
    final cache = LocalCache(storage: const FlutterSecureStorage())
      ..account = 'a';
    await cache.enqueue('a', {
      'orderId': 3,
      'verifiedAt': '2026-10-19T12:00:00Z',
      '_blocked': true,
      '_error': 'HTTP 422: GPS inválido'
    });
    final sync = ProofSync(cache: cache, client: fakeDio((o) => {}));
    sl.registerSingleton(sync);
    await sync.reload();
    await tester.pumpWidget(
        MaterialApp(theme: AppTheme.darkTheme, home: const SyncPage()));
    expect(find.textContaining('1 pendientes de confirmación'), findsOneWidget);
    expect(find.textContaining('Rechazado; requiere revisión'), findsOneWidget);
    expect(find.textContaining('GPS inválido'), findsOneWidget);
    expect(find.textContaining('entregada'), findsNothing);
    sync.dispose();
  });
  testWidgets(
      'Empty signature cannot be confirmed and clear invalidates saved value',
      (tester) async {
    String? saved;
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: SignaturePad(
                captureImage: (_) async => base64Decode(
                    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNCEAAAAASUVORK5CYII='),
                onSaved: (s) {
                  saved = s;
                }))));
    await tester.tap(find.text('Confirmar Firma'));
    await tester.pump();
    expect(saved, isNull);
    final canvas = find.byKey(const ValueKey('signature-canvas'));
    final detector = tester.widget<GestureDetector>(canvas);
    detector.onPanStart!(DragStartDetails(localPosition: const Offset(20, 20)));
    for (final point in [
      const Offset(40, 40),
      const Offset(60, 50),
      const Offset(80, 60)
    ]) {
      detector.onPanUpdate!(
          DragUpdateDetails(localPosition: point, globalPosition: point));
    }
    detector.onPanEnd!(DragEndDetails());
    await tester.pump();
    final painted = tester.widget<CustomPaint>(
        find.descendant(of: canvas, matching: find.byType(CustomPaint)));
    expect((painted.painter as dynamic).strokes.first.length, greaterThan(2));
    await tester.tap(find.text('Confirmar Firma'));
    await tester.pumpAndSettle();
    expect(saved, isNotEmpty);
    await tester.tap(find.text('Limpiar'));
    await tester.pump();
    expect(saved, isNull);
  });
}
