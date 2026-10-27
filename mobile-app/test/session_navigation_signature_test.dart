import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ecoroute_driver_app/features/orders/presentation/widgets/signature_pad.dart';

final _png = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNCEAAAAASUVORK5CYII=');

Future<void> _draw(WidgetTester tester) async {
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
}

Future<void> _mount(WidgetTester tester, List<String?> saved,
    Future<Uint8List> Function(RenderRepaintBoundary) capture) async {
  await tester.pumpWidget(MaterialApp(
      home: Scaffold(
          body: SignaturePad(captureImage: capture, onSaved: saved.add))));
  await _draw(tester);
  saved.clear(); // Drawing invalidates an earlier signature via onSaved(null).
}

void main() {
  testWidgets(
      'Signature capture Dart error reports failure and keeps page open',
      (tester) async {
    final saved = <String?>[];
    await _mount(
        tester, saved, (_) async => throw StateError('Fake codec error'));
    await tester.tap(find.text('Confirmar Firma'));
    await tester.pump();
    expect(tester.takeException(), isA<StateError>());
    expect(saved, isEmpty);
    expect(find.byType(SignaturePad), findsOneWidget);
    expect(find.text('No se pudo guardar la firma; reintente'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('Signature capture timeout does not save or navigate away',
      (tester) async {
    final saved = <String?>[];
    final pending = Completer<Uint8List>();
    await _mount(tester, saved, (_) => pending.future);
    await tester.tap(find.text('Confirmar Firma'));
    await tester.pump(const Duration(seconds: 11));
    expect(tester.takeException(), isA<TimeoutException>());
    expect(saved, isEmpty);
    expect(find.byType(SignaturePad), findsOneWidget);
    expect(find.text('No se pudo guardar la firma; reintente'), findsOneWidget);
    pending.complete(_png);
    await tester.pump();
    expect(saved, isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  for (final action in ['clear', 'draw', 'unmount']) {
    testWidgets('Pending signature capture after $action discards stale image',
        (tester) async {
      final saved = <String?>[];
      final pending = Completer<Uint8List>();
      await _mount(tester, saved, (_) => pending.future);
      await tester.tap(find.text('Confirmar Firma'));
      if (action == 'clear') {
        await tester.tap(find.text('Limpiar'));
      } else if (action == 'draw') {
        await _draw(tester);
      } else {
        await tester.pumpWidget(const SizedBox.shrink());
      }
      pending.complete(_png);
      await tester.pump();
      expect(saved.whereType<String>(), isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }

  testWidgets('Signature capture success delivers only the encoded image',
      (tester) async {
    final saved = <String?>[];
    await _mount(tester, saved, (_) async => _png);
    await tester.tap(find.text('Confirmar Firma'));
    await tester.pump();
    expect(base64Decode(saved.single!), orderedEquals(_png));
    expect(find.byType(SignaturePad), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
