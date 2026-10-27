# Ventanas de entrega y reconfirmación · 2026-10-19

Alcance de esta ampliación: exclusivamente `web-admin/**`. Sin cambios de backend/móvil, sin commits ni eliminación de datos. No se consultó POD real ni se ejecutaron mutaciones operativas. La corrección de persistencia S3/LocalStack queda a cargo del principal.

## Implementación

* `src/services/orderService.ts`: `updateDeliveryWindow(id, request)` consume PATCH `/orders/{id}/delivery-window` y recibe `Order`. Envía únicamente `estimatedDeliveryWindowStart`, `estimatedDeliveryWindowEnd` y `reason`; no envía ni fabrica actor o campos comerciales.
* `src/utils/deliveryWindow.ts`: presentación de timestamps en America/Lima independientemente de la zona del navegador; serialización ISO con offset `-05:00`; valida fechas reales, ambos extremos, fin posterior al inicio, fin estrictamente futuro y motivo de cinco caracteres tras trim. El inicio puede estar en el pasado si el fin sigue siendo futuro, acorde al contrato.
* `src/components/DeliveryWindowEditor.tsx`: formulario en el detalle de Orders, incluyendo pedidos existentes ASSIGNED creados por REPLAN. Edita solo PENDING/ASSIGNED, sin ruta o con ruta verificada PLANNED. Ruta sin información, en progreso, cerrada o pedido terminal → ventana de solo lectura. Conserva edición y motivo ante error/409; permite descartar el borrador local.
* `src/pages/Orders.tsx`: integra ventana y revisión comercial. Una edición pendiente bloquea la confirmación comercial. Tras PATCH exitoso descarta cualquier aceptación comercial local anterior, vuelve a consultar business-data y muestra `customerAccepted=false`; conserva RUC y revisiones guardadas de dirección/cobertura. No confirma automáticamente: el operador debe marcar nuevamente aceptación y guardar las condiciones en una petición separada a business-data.
* Se informa que el cambio de ventana invalida revisión y aceptación de la ruta. El actor y la invalidación persistida son responsabilidad del backend; la web no llama a acceptance del conductor.
* Se corrigió una recarga relacionada: tanto guardar revisión comercial como cambiar ventana recrean la consulta de confirmación usada por la asignación. Así no queda bloqueada o habilitada por una respuesta anterior al cambio.
* La explicación de confirmación pendiente ya no afirma que todo pedido está en borrador: un nuevo intento replanificado puede conservar estado ASSIGNED mientras renueva el acuerdo.

El pendiente de contrato de edición de ventana señalado en el informe general previo queda resuelto en la implementación web con el contrato comunicado en este turno. No se ha probado esta ampliación contra el endpoint operativo real.

## Pruebas ejecutadas

Runtime Node bundled v24.19.0, mismo directorio de dependencias de la intervención anterior. Sin instalaciones nuevas.

* TypeScript `tsc -b`: exit 0.
* ESLint `eslint . --max-warnings 0`: exit 0, sin reglas desactivadas.
* `node --test tests/*.test.mjs`: **21/21 PASS**, 0 omitidas/fallos. Incluye seis casos nuevos de zona horaria, offsets/payload, límite Lima, fechas inválidas, reglas de fin/motivo y habilitación por estado/ruta, además de los quince casos previos.
* Build producción: exit 0, 1884 módulos, JS aprox. 729.85 kB / gzip 233.61 kB en la ejecución anterior al ajuste final de texto. Persiste aviso de bundle superior a 500 kB; no se ocultó ni se cambió su umbral.
* `tests/delivery-window-ui.mjs`: **7/7 PASS**, en Edge headless con zona de navegador Asia/Tokyo. Todas las APIs están interceptadas; tres PATCH de prueba se resuelven únicamente en memoria (guardar ventana, confirmar acuerdo y rechazo 409). Ninguna petición API se reenvía al backend; POD solo responde desde fixture 404. **0 mutaciones operativas y 0 errores JS de página**. Cuatro capturas vigentes en su manifiesto.
* `tests/ui-readonly.mjs`: regresión previa **13/13 PASS**, 0 intentos de mutación y 0 errores JS; todas las APIs/POD son fixtures aislados. Mantiene las 26 capturas del manifiesto de esa suite.
* Primer intento nuevo de UI: una aserción esperaba segundos `:00` que datetime-local normaliza y omite en su valor DOM. Se corrigió la aserción para admitir ambas representaciones; el offset del payload sí se comprobó exactamente con segundos. No se atribuye ese intento fallido a integración backend.
* Captura del estado posterior al guardado inspeccionada visualmente: muestra ventana nueva, aceptación del cliente desmarcada, RUC y dirección/cobertura conservados.

Resultados y capturas: `web-admin/tools/audit_e2e/delivery-window-ui/results.json`. La captura `failure_fixture.png` corresponde al primer intento fallido y no forma parte del manifiesto aprobado.

## Escenarios observados con fixtures

1. ASSIGNED de REPLAN muestra ventana original en Lima aunque el navegador esté en Tokio.
2. Edición no guardada bloquea confirmación comercial; descartar restaura los valores.
3. PATCH de ventana usa el mismo pedido, timestamps con offset y motivo; conserva RUC/address/coverage y desmarca aceptación.
4. La reconfirmación comercial requiere acción explícita y otra petición sobre el mismo ID.
5. Conflicto 409 conserva borrador y razón real del servidor; no altera la aceptación de un cambio rechazado.
6. Fin pasado se rechaza localmente sin enviar PATCH.
7. DISPATCHER puede editar PENDING; ruta IN_PROGRESS o pedido terminal no ofrecen escritura de ventana.

Pendiente: verificación coordinada contra backend real de auditoría de actor, invalidación persistida de aceptación/revisión, permisos y nuevo flujo REPLAN → ventana → aceptación → aprobación. UAT humana pendiente; no se sustituye con estas pruebas de interfaz. No acceder a POD real hasta aviso del principal.
