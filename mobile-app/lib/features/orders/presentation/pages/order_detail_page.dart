import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../domain/entities/order.dart';
import '../bloc/order_bloc.dart';
import '../bloc/order_event.dart';
import '../bloc/order_state.dart';
import '../widgets/signature_pad.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/sync/proof_sync.dart';
import '../../../../core/utils/valid_coordinates.dart';
import '../../../gps/data/datasources/gps_sensor_data_source.dart';

class OrderDetailPage extends StatefulWidget {
  final OrderEntity order;
  final bool canOperate;

  const OrderDetailPage(
      {super.key, required this.order, this.canOperate = false});

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  File? _imageEvidence;
  final ImagePicker _picker = ImagePicker();
  late String _selectedStatus;
  late bool _isReadOnly;
  String? _signatureBase64;
  late TextEditingController _receiverNameController;
  late TextEditingController _receiverDniController;
  final _reasonController = TextEditingController();
  bool _capturingGps = false;
  bool _pendingProof = false;
  bool _checkingPending = true;

  List<String> get _statuses => [
        widget.order.status,
        ...switch (widget.order.status) {
          'ASSIGNED' => ['PICKED_UP'],
          'PICKED_UP' => ['IN_TRANSIT', 'FAILED'],
          'IN_TRANSIT' => ['DELIVERED', 'FAILED', 'RETURNED'],
          _ => <String>[],
        }
      ];

  @override
  void initState() {
    super.initState();
    _selectedStatus = widget.order.status;
    // CRITICAL FIX: If status is DELIVERED or FAILED, it MUST be read-only
    _isReadOnly = !widget.canOperate ||
        widget.order.terminal ||
        widget.order.status == 'PENDING';
    _receiverNameController =
        TextEditingController(text: widget.order.recipientName);
    _receiverDniController = TextEditingController();
    _checkPending();
  }

  Future<void> _checkPending() async {
    final sync = sl<ProofSync>();
    await sync.reload();
    if (!mounted) return;
    setState(() {
      _pendingProof = sync.items.any((p) => p['orderId'] == widget.order.id);
      _isReadOnly = _isReadOnly || _pendingProof || sync.error != null;
      _checkingPending = false;
    });
  }

  @override
  void dispose() {
    _receiverNameController.dispose();
    _receiverDniController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _takePhoto() async {
    if (_isReadOnly) return;
    final XFile? photo = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70,
    );

    if (photo != null && mounted) {
      setState(() {
        _imageEvidence = File(photo.path);
      });
    }
  }

  Future<void> _submitDelivery() async {
    if (_isReadOnly || _checkingPending || _capturingGps) return;
    if (['FAILED', 'RETURNED'].contains(_selectedStatus) &&
        _reasonController.text.trim().length < 5) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content:
              Text('Describa el motivo de no entrega (mínimo 5 caracteres)')));
      return;
    }
    if (_selectedStatus == widget.order.status) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Seleccione el siguiente estado de la operación')));
      return;
    }
    if (_selectedStatus == 'DELIVERED' &&
        (_imageEvidence == null ||
            (_signatureBase64?.isEmpty ?? true) ||
            _receiverNameController.text.trim().isEmpty ||
            !RegExp(r'^\d{8}$').hasMatch(_receiverDniController.text.trim()) ||
            _receiverDniController.text.trim() == '00000000')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Complete foto, firma confirmada, nombre del receptor y DNI válido de 8 dígitos.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    double? lat;
    double? lng;
    DateTime? capturedAt;
    if (_selectedStatus == 'DELIVERED') {
      setState(() => _capturingGps = true);
      try {
        final gps = sl<GpsSensorDataSource>();
        if (!await gps.checkAndRequestPermissions()) {
          throw StateError('Permita ubicación y active GPS');
        }
        final position = await gps.getCurrentLocation();
        if (!validCoordinates(position.latitude, position.longitude) ||
            DateTime.now().difference(position.timestamp).abs() >
                const Duration(minutes: 2)) {
          throw StateError(
              'GPS inválido o antiguo. Reintente en una zona con señal');
        }
        lat = position.latitude;
        lng = position.longitude;
        capturedAt = position.timestamp;
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text('No se puede confirmar sin GPS actual: $e')));
        }
        return;
      } finally {
        if (mounted) setState(() => _capturingGps = false);
      }
    }
    if (!mounted) return;
    context.read<OrderBloc>().add(UpdateOrderStatusEvent(
          widget.order.id,
          _selectedStatus,
          lat: lat,
          lng: lng,
          capturedAt: capturedAt,
          reason: _reasonController.text.trim(),
          imagePath: _imageEvidence?.path,
          signatureBase64: _signatureBase64,
          receiverName: _receiverNameController.text.trim().isNotEmpty
              ? _receiverNameController.text.trim()
              : null,
          receiverDni: _receiverDniController.text.trim().isNotEmpty
              ? _receiverDniController.text.trim()
              : null,
        ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Pedido #${widget.order.trackingNumber}'),
      ),
      body: BlocConsumer<OrderBloc, OrderState>(
        listener: (context, state) {
          if (state is OrderUpdateSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(switch (state.result) {
                  SubmissionResult.confirmed =>
                    'Operación confirmada por el servidor.',
                  SubmissionResult.queued =>
                    'Evidencia guardada. Pendiente de confirmación del servidor.',
                  SubmissionResult.rejected =>
                    'Evidencia guardada, rechazada por el servidor. Revise Sincronización.',
                }),
              ),
            );
            context
                .read<OrderBloc>()
                .add(LoadOrdersByRouteEvent(widget.order.routeId));
            context.pop();
          } else if (state is OrderError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Colors.red,
              ),
            );
          }
        },
        builder: (context, state) {
          return AbsorbPointer(
              absorbing: _capturingGps || state is OrderUpdating,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_checkingPending) const LinearProgressIndicator(),
                    if (_pendingProof)
                      TextButton.icon(
                          onPressed: () => context.push('/sync'),
                          icon: const Icon(Icons.sync),
                          label: const Text(
                              'Evidencia pendiente de confirmación. Ver sincronización')),
                    if (widget.order.cached)
                      const Text(
                          'Datos guardados sin conexión; el estado del servidor puede haber cambiado.'),
                    if (_isReadOnly)
                      Card(
                        color: Colors.green[700],
                        child: const Padding(
                          padding: EdgeInsets.all(12.0),
                          child: Row(
                            children: [
                              Icon(Icons.lock, color: Colors.white),
                              SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                    'OPERACIÓN BLOQUEADA\nRuta sin despacho, pedido terminal, sin asignación o con evidencia pendiente.',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 16),

                    // 📦 Info del cliente
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Cliente: ${widget.order.recipientName}',
                                style: const TextStyle(
                                    fontSize: 18, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            Text('Dirección: ${widget.order.deliveryAddress}'),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // 🔄 Selector de Estado
                    const Text('Estado del Pedido',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedStatus,
                      decoration:
                          const InputDecoration(border: OutlineInputBorder()),
                      // CRITICAL FIX: Set onChanged to null to disable the dropdown
                      onChanged: _isReadOnly ||
                              _capturingGps ||
                              _checkingPending ||
                              state is OrderUpdating
                          ? null
                          : (value) {
                              setState(() {
                                _selectedStatus = value!;
                              });
                            },
                      items: _statuses.map((status) {
                        return DropdownMenuItem(
                          value: status,
                          child: Text(status),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 24),

                    // 📸 Captura de Evidencia
                    if (!_isReadOnly &&
                        ['FAILED', 'RETURNED'].contains(_selectedStatus))
                      TextField(
                          controller: _reasonController,
                          maxLength: 1000,
                          minLines: 2,
                          maxLines: 4,
                          decoration: const InputDecoration(
                              labelText: 'Motivo de no entrega',
                              border: OutlineInputBorder())),
                    const Text('Evidencia Fotográfica',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap:
                          _isReadOnly || _capturingGps || state is OrderUpdating
                              ? null
                              : _takePhoto,
                      child: Container(
                        height: 200,
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .colorScheme
                              .surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey),
                        ),
                        child: _imageEvidence != null
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.file(_imageEvidence!,
                                    fit: BoxFit.cover),
                              )
                            : Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.camera_alt,
                                      size: 64,
                                      color: _isReadOnly
                                          ? Colors.grey[400]
                                          : Colors.grey),
                                  const SizedBox(height: 8),
                                  Text(
                                      _isReadOnly
                                          ? 'Evidencia guardada'
                                          : 'Tocar para abrir la cámara',
                                      style: TextStyle(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurfaceVariant)),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Datos del receptor - only show when delivering
                    if (!_isReadOnly && _selectedStatus == 'DELIVERED') ...[
                      const Text('Datos del Receptor',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _receiverNameController,
                        decoration: const InputDecoration(
                          labelText: 'Nombre del Receptor',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.person),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _receiverDniController,
                        decoration: const InputDecoration(
                          labelText: 'DNI del Receptor',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.badge),
                          hintText: '12345678',
                        ),
                        keyboardType: TextInputType.number,
                        maxLength: 8,
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Firma del receptor - only show when delivering
                    if (!_isReadOnly && _selectedStatus == 'DELIVERED')
                      SignaturePad(
                        onSaved: (base64) {
                          setState(() {
                            _signatureBase64 = base64;
                          });
                          if (base64 == null) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Firma capturada correctamente'),
                              backgroundColor: Colors.green,
                              duration: Duration(seconds: 1),
                            ),
                          );
                        },
                      ),
                    if (_signatureBase64 != null &&
                        _selectedStatus == 'DELIVERED')
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Row(
                          children: [
                            Icon(Icons.check_circle,
                                color: Colors.green, size: 16),
                            SizedBox(width: 4),
                            Text('Firma guardada',
                                style: TextStyle(color: Colors.green)),
                          ],
                        ),
                      ),
                    const SizedBox(height: 32),

                    // Boton Guardar
                    if (!_isReadOnly)
                      ElevatedButton(
                        onPressed: state is OrderUpdating ||
                                _capturingGps ||
                                _checkingPending
                            ? null
                            : _submitDelivery,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2E7D32),
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(50),
                        ),
                        child: state is OrderUpdating
                            ? const SizedBox(
                                height: 24,
                                width: 24,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2))
                            : const Text('GUARDAR ESTADO',
                                style: TextStyle(
                                    fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                  ],
                ),
              ));
        },
      ),
    );
  }
}
