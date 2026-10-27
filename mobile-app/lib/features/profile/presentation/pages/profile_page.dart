import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';

import '../../../../core/di/injection_container.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../auth/presentation/bloc/auth_event.dart';
import '../../../auth/presentation/bloc/auth_state.dart';
import '../../../../core/theme/theme_bloc.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic>? _driverDetails;
  bool _loadingDetails = true;
  String? _detailsError;

  @override
  void initState() {
    super.initState();
    _fetchDriverDetails();
  }

  Future<void> _fetchDriverDetails() async {
    final authState = context.read<AuthBloc>().state;
    if (authState is! Authenticated) {
      setState(() => _loadingDetails = false);
      return;
    }
    try {
      final dio = sl<Dio>();
      final response = await dio.get('/drivers/${authState.user.id}');
      if (!mounted) return;
      if (response.statusCode == 200 && response.data != null) {
        setState(() {
          _driverDetails = response.data as Map<String, dynamic>;
          _loadingDetails = false;
        });
        return;
      }
    } catch (_) {
      _detailsError = 'No se pudieron consultar los datos del conductor';
    }
    if (!mounted) return;
    setState(() => _loadingDetails = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Perfil del Conductor'),
      ),
      body: BlocBuilder<AuthBloc, AuthState>(
        builder: (context, authState) {
          if (authState is! Authenticated) {
            return const Center(child: Text('No autenticado'));
          }

          final user = authState.user;
          final fullName = [
            _driverDetails?['firstName']?.toString() ?? '',
            _driverDetails?['lastName']?.toString() ?? '',
          ].where((part) => part.trim().isNotEmpty).join(' ');
          final driverName = fullName.isNotEmpty ? fullName : user.name;
          final driverEmail =
              _driverDetails?['email']?.toString() ?? user.email;
          final driverPhone = _driverDetails?['phoneNumber']?.toString();
          final driverLicense = _driverDetails?['licenseNumber']?.toString();

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                // Avatar placeholder
                CircleAvatar(
                  radius: 50,
                  backgroundColor:
                      Theme.of(context).colorScheme.primaryContainer,
                  child: Text(
                    driverName.isNotEmpty ? driverName[0].toUpperCase() : 'D',
                    style: const TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  driverName,
                  style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'ID: ${user.id}',
                  style: const TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 24),

                if (_loadingDetails)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(),
                  ),

                // Info cards
                _InfoCard(
                  icon: Icons.email,
                  label: 'Correo',
                  value: driverEmail,
                ),
                _InfoCard(
                  icon: Icons.badge,
                  label: 'Rol',
                  value: user.roles.join(', '),
                ),
                _InfoCard(
                  icon: Icons.drive_eta,
                  label: 'Licencia',
                  value: driverLicense ?? 'No disponible',
                ),
                _InfoCard(
                  icon: Icons.phone,
                  label: 'Telefono',
                  value: driverPhone ?? 'No disponible',
                ),

                const SizedBox(height: 24),

                // Theme toggle
                if (_detailsError != null) Text(_detailsError!),
                TextButton.icon(
                    onPressed: () => context.push('/sync'),
                    icon: const Icon(Icons.sync),
                    label: const Text('Sincronización de evidencias')),
                BlocBuilder<ThemeBloc, ThemeState>(
                  builder: (context, themeState) {
                    return Card(
                      child: ListTile(
                        leading: Icon(
                          themeState.isDark
                              ? Icons.dark_mode
                              : Icons.light_mode,
                        ),
                        title: const Text('Modo Oscuro'),
                        trailing: Switch(
                          value: themeState.isDark,
                          onChanged: (_) {
                            context.read<ThemeBloc>().add(ToggleTheme());
                          },
                        ),
                      ),
                    );
                  },
                ),

                const SizedBox(height: 24),

                // Logout button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      context.read<AuthBloc>().add(LogoutRequested());
                      context.go('/login');
                    },
                    icon: const Icon(Icons.logout),
                    label: const Text('Cerrar Sesion'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(50),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(label,
            style: const TextStyle(fontSize: 12, color: Colors.grey)),
        subtitle: Text(value, style: const TextStyle(fontSize: 16)),
      ),
    );
  }
}
