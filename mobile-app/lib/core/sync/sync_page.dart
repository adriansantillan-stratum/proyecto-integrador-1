import 'package:flutter/material.dart';
import '../di/injection_container.dart';
import 'proof_sync.dart';

class SyncPage extends StatelessWidget {
  const SyncPage({super.key});
  @override
  Widget build(BuildContext context) {
    final sync = sl<ProofSync>();
    return Scaffold(
        appBar: AppBar(title: const Text('Sincronización de evidencias')),
        body: ListenableBuilder(
            listenable: sync,
            builder: (context, _) => Column(children: [
                  Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                          '${sync.count} pendientes de confirmación. La evidencia está guardada en esta cuenta. '
                          'Reintento cada 30 s con la app abierta, al regresar y al volver a iniciar sesión.')),
                  if (sync.error != null)
                    Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(sync.error!)),
                  if (sync.busy) const LinearProgressIndicator(),
                  FilledButton.icon(
                      onPressed: sync.busy
                          ? null
                          : () => sync.sync(retryRejected: true),
                      icon: const Icon(Icons.sync),
                      label: const Text('Reintentar pendientes y rechazados')),
                  Expanded(
                      child: sync.items.isEmpty
                          ? const Center(
                              child: Text('Sin evidencias pendientes'))
                          : ListView.builder(
                              itemCount: sync.items.length,
                              itemBuilder: (context, i) {
                                final p = sync.items[i];
                                return Card(
                                    child: ListTile(
                                  leading: Icon(p['_blocked'] == true
                                      ? Icons.error_outline
                                      : Icons.cloud_upload_outlined),
                                  title: Text(
                                      'Pedido #${p['orderId']} · ${p['_blocked'] == true ? 'Rechazado; requiere revisión' : 'Pendiente'}'),
                                  subtitle: Text(
                                      'Captura: ${p['verifiedAt']}\n${p['_error'] ?? 'Esperando envío'}\n'
                                      'Último intento: ${p['_lastAttempt'] ?? 'sin intentos'}'),
                                ));
                              })),
                ])));
  }
}
