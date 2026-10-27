import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Complete photo/signature bytes in private encrypted storage, never transient paths.
/// Legacy unscoped cache keys are deliberately not read.
class LocalCache {
  final FlutterSecureStorage storage;
  String? account;
  Future<void> _lock = Future.value();
  LocalCache({required this.storage});
  String requireAccount() {
    final value = account;
    if (value == null || value.isEmpty) throw StateError('Sin cuenta activa');
    return value;
  }

  String _key(String owner, String name) =>
      'v2_${base64Url.encode(utf8.encode(owner))}_$name';
  Future<void> write(String owner, String name, Object data) =>
      storage.write(key: _key(owner, name), value: jsonEncode(data));
  Future<dynamic> read(String owner, String name) async {
    final raw = await storage.read(key: _key(owner, name));
    return raw == null ? null : jsonDecode(raw);
  }

  Future<List<Map<String, dynamic>>> pending(String owner) async =>
      ((await read(owner, 'proofs')) as List? ?? [])
          .map((p) => Map<String, dynamic>.from(p))
          .toList();
  Future<void> mutate(
      String owner, void Function(List<Map<String, dynamic>>) change) {
    final next = _lock.then((_) async {
      final items = await pending(owner);
      change(items);
      await write(owner, 'proofs', items);
    });
    _lock = next.catchError((Object _) {});
    return next;
  }

  Future<void> enqueue(String owner, Map<String, dynamic> proof) =>
      mutate(owner, (items) {
        if (!items.any((p) => p['orderId'] == proof['orderId'])) {
          items.add(proof);
        }
      });
  Future<void> remove(String owner, int orderId) => mutate(
      owner, (items) => items.removeWhere((p) => p['orderId'] == orderId));
}
