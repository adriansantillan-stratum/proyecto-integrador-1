import 'package:flutter/material.dart';

/// Simplified notification helper using SnackBars.
/// No external dependencies required.
class NotificationHelper {
  /// Shows a delivery completion notification.
  static void showDeliveryComplete(BuildContext context, String trackingNumber) {
    _showSnackBar(
      context,
      message: 'Entrega #$trackingNumber completada exitosamente',
      icon: Icons.check_circle,
      backgroundColor: Colors.green,
    );
  }

  /// Shows a new route assignment notification.
  static void showNewRouteAssigned(BuildContext context, int routeId) {
    _showSnackBar(
      context,
      message: 'Nueva ruta #$routeId asignada',
      icon: Icons.route,
      backgroundColor: const Color(0xFF2563EB),
    );
  }

  /// Shows a notification when data is saved offline.
  static void showOfflineSaved(BuildContext context) {
    _showSnackBar(
      context,
      message: 'Sin conexion - datos guardados localmente',
      icon: Icons.cloud_off,
      backgroundColor: Colors.orange,
    );
  }

  /// Shows a notification when pending proofs are synced.
  static void showSyncComplete(BuildContext context, int count) {
    _showSnackBar(
      context,
      message: '$count evidencias pendientes sincronizadas',
      icon: Icons.cloud_done,
      backgroundColor: Colors.green,
    );
  }

  /// Shows an error notification.
  static void showError(BuildContext context, String message) {
    _showSnackBar(
      context,
      message: message,
      icon: Icons.error_outline,
      backgroundColor: Colors.red,
    );
  }

  static void _showSnackBar(
    BuildContext context, {
    required String message,
    required IconData icon,
    required Color backgroundColor,
  }) {
    if (!context.mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(
              child: Text(message, style: const TextStyle(color: Colors.white)),
            ),
          ],
        ),
        backgroundColor: backgroundColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        duration: const Duration(seconds: 3),
      ),
    );
  }
}
