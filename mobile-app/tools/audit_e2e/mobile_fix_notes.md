# Correcciones móviles H04/H05/H07/H16/H20 — 2026-10-19

Ámbito exclusivo: `mobile-app/**`. Este informe se ubica bajo `mobile-app/tools/audit_e2e/` para respetar ese límite. Sin commits, cambios backend/web, Word, instalaciones APK ni ADB. Se preservaron cambios existentes fuera del módulo. No se delegó trabajo.

## Registro verificable (en curso)

- Inspección de `pubspec.yaml`, fuentes Dart, manifiesto Android, Info.plist iOS y prueba preexistente (contador ajeno a la app).
- `flutter --version`: Flutter 3.41.4, Dart 3.11.1. Primer intento restringido no terminó y fue interrumpido; ejecución con acceso a caché del SDK terminó correctamente. SDK sin parches.
- `flutter analyze --no-pub`: iniciado; resultado pendiente de registrar.
- `flutter test`: pendiente.
- Prueba humana UAT / integración contra backend / cámara y GPS reales: NO ejecutadas.

## Semántica offline implementada

La foto se lee y codifica junto con firma, receptor, DNI, GPS y fecha de captura; el conjunto completo se escribe en FlutterSecureStorage antes del primer POST. No se persiste una ruta temporal de cámara. Las claves incluyen el subject validado de `/session/me`; las claves globales antiguas no se leen. La escritura concurrente de cola se serializa. El primer POD por orderId prevalece y no se sobrescribe al repetir.

Una respuesta satisfactoria permite retirar el registro; un error conserva evidencia y diagnóstico. 4xx definitivos quedan rechazados y visibles, con reintento manual; 401/408/429 y transporte/5xx pueden reintentarse. La UI distingue confirmado, pendiente y rechazado. El temporizador de 30 s se ejecuta con el proceso vivo; también se intenta al resume y al restaurar/iniciar la cuenta. Se conservan colas al cerrar sesión para recuperarlas únicamente con la misma cuenta.

## Cadenas de funciones

- POD: OrderDetailPage._submitDelivery → GPS actual → UpdateOrderStatusEvent(lat,lng,capturedAt) → OrderBloc → UpdateOrderStatusUseCase → OrderRepositoryImpl → LocalCache.enqueue → ProofSync.sync → POST /delivery-proofs → resultado tipado → UI.
- GPS: selección RouteEntity(driverId,vehicleId,status) → RouteTrackingChanged → GpsRepository.setRoute → posición actual/stream → ping inicial → POST /gps/ping. Sin fallback de vehículo o conductor; ambos ejes 0 inválidos.
- Sesión: Keycloak token → GET /session/me → UserModel(subject,driverId,roles,refreshToken) → almacenamiento privado. AuthInterceptor 401 → SessionRefresh compartido → reintento único. Logout invalida renovación, aísla cola, borra sesión y solicita logout Keycloak.
- Rutas: listado propio → selección explícita → pedidos por ruta → path desde coordenadas actuales con throttle → OSRM o aproximación etiquetada sin ETA. Review/acceptance consultan endpoints previstos; aceptación solo se informa tras respuesta satisfactoria.
- Historial: sesión actual → rutas del conductor → pedidos propios terminales → fecha verificable → período elegido. Fallos se propagan a pantalla.

## Limitaciones y validaciones pendientes

- No hay servicio nativo de background ni ejecución garantizada con proceso terminado, app suspendida por SO o dispositivo apagado. La recuperación requiere abrir la app; no se promete sincronización en segundo plano.
- La persistencia real, límites de tamaño de almacenamiento seguro, cámara, GPS, permisos y suspensión deben medirse en Android/iOS. Las pruebas con fakes no certifican cifrado, hardware ni durabilidad ante fallos del sistema de archivos.
- Las reglas y endpoints backend deben verificarse en integración; no se presume disponibilidad de review/acceptance ni efecto real de first-proof-wins, filtrado de dueño o rechazo de GPS.
- El historial verifica pertenencia actual de ruta más respuesta del backend y fechas; atribución histórica tras reasignar conductor depende del filtro/auditoría del backend.

## Escenarios UAT pendientes (no ejecutados)

1. Rechazar GPS / apagar servicio / obtener 0,0: entrega bloqueada y mensaje visible.
2. Foto+firma+receptor+DNI completos; GPS actual: confirmar POD y verificar coordenadas/fecha en servidor.
3. Modo avión: guardar POD, ver pendiente y contador; cerrar proceso, reabrir misma cuenta, recuperar cola; reconectar con app abierta y confirmar exactamente un POD.
4. Cerrar sesión con pendientes, entrar con otra cuenta y comprobar aislamiento; volver a la primera y recuperar evidencia.
5. Forzar 400/403/409/422: conservar POD rechazado, mostrar motivo y permitir reintento; forzar 5xx/timeout para reintento automático.
6. Dos requests con token vencido: una renovación; refresh rechazado: cerrar sesión; logout sin red: aviso de revocación no confirmada.
7. Dos rutas activas con vehículos diferentes: alternar, verificar contador/órdenes/ping con vehículo correcto; aceptar hoja PLANNED y revisar metadatos.
8. Historial con 7/30/90 días, otra cuenta, error de servidor y fecha ausente: sin encubrir fallos con lista vacía.
9. Movimiento real: throttling OSRM, secuencia alineada lista/mapa, fallback aproximado sin ETA falsa; contraste en modo oscuro.
