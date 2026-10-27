import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import '../cache/local_cache.dart';

enum SubmissionResult { confirmed, queued, rejected }

/// Retries while the process runs, on foreground resume and after account restore.
/// OS background execution/termination is not promised by this foreground worker.
class ProofSync extends ChangeNotifier with WidgetsBindingObserver {
  final LocalCache cache;
  final Dio client;
  final Map<String, Future<void>> _flights = {};
  Timer? _timer;
  List<Map<String, dynamic>> items = [];
  String? error;
  bool get busy => cache.account != null && _flights.containsKey(cache.account);
  int get count => items.length;
  int confirmedCount = 0;
  ProofSync({required this.cache, required this.client});
  void start() {
    WidgetsBinding.instance.addObserver(this);
    _timer ??= Timer.periodic(const Duration(seconds: 30), (_) => sync());
  }

  void accountChanged() {
    items = [];
    error = null;
    notifyListeners();
    if (cache.account != null) unawaited(sync());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(sync());
  }

  Future<void> reload() async {
    final owner = cache.account;
    if (owner == null) return;
    try {
      final pending = await cache.pending(owner);
      if (cache.account == owner) {
        items = pending;
        notifyListeners();
      }
    } catch (_) {
      if (cache.account == owner) {
        error =
            'No se pudo leer la cola privada. No se ha eliminado evidencia.';
        notifyListeners();
      }
    }
  }

  Future<SubmissionResult> submit(
      String owner, Map<String, dynamic> proof) async {
    await cache.enqueue(
        owner, proof); // Durable write MUST finish before any HTTP.
    await reload();
    await sync();
    final pending = await cache.pending(owner);
    final match = pending.where((p) => p['orderId'] == proof['orderId']);
    if (match.isEmpty) return SubmissionResult.confirmed;
    return match.first['_blocked'] == true
        ? SubmissionResult.rejected
        : SubmissionResult.queued;
  }

  Future<void> sync({bool retryRejected = false}) async {
    final owner = cache.account;
    if (owner == null) return;
    final existing = _flights[owner];
    if (existing != null) return existing;
    error = null;
    final work = _drain(owner, retryRejected);
    _flights[owner] = work;
    notifyListeners();
    try {
      await work;
    } finally {
      _flights.remove(owner);
      await reload();
      notifyListeners();
    }
  }

  Future<void> _drain(String owner, bool retryRejected) async {
    try {
      final pending = await cache.pending(owner);
      if (cache.account == owner) {
        items = pending;
        notifyListeners();
      }
      for (final proof in pending) {
        if (cache.account != owner) break;
        if (proof['_blocked'] == true && !retryRejected) continue;
        try {
          final payload = Map<String, dynamic>.from(proof)
            ..removeWhere((k, _) => k.startsWith('_'));
          await client.post('/delivery-proofs',
              data: payload,
              options: Options(
                  extra: {'account': owner},
                  headers: {'Idempotency-Key': '${proof['orderId']}'}));
          await cache.remove(owner, proof['orderId'] as int);
          if (cache.account == owner) confirmedCount++;
        } catch (e) {
          final status = e is DioException ? e.response?.statusCode : null;
          final blocked = status != null &&
              status >= 400 &&
              status < 500 &&
              status != 401 &&
              status != 408 &&
              status != 429;
          await cache.mutate(owner, (items) {
            for (final p
                in items.where((p) => p['orderId'] == proof['orderId'])) {
              p['_blocked'] = blocked;
              p['_lastAttempt'] = DateTime.now().toUtc().toIso8601String();
              p['_error'] = status == null
                  ? 'Sin conexión o envío interrumpido; pendiente'
                  : 'HTTP $status: ${e is DioException ? e.response?.data : 'Error de envío'}';
            }
          });
        }
      }
    } catch (_) {
      if (cache.account == owner) {
        error = 'No se pudo procesar la cola; evidencia conservada. Reintente.';
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
