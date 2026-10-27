# Plan de pruebas de usuario de EcoRoute / MICOTRANS

Versión de criterios 2026-10-19. Estado de aceptación empresarial: pendiente en todos los casos. Este documento prescribe 96 escenarios: nueve por cada uno de los nueve procesos revisados y quince de soporte. Las ejecuciones técnicas posteriores se registran aparte, con su alcance y versión; no se convierten automáticamente en aprobación humana de estos casos.

## Alcance, responsables y evidencia

La referencia de negocio son los nueve archivos `docs/entregables_procesos_ecoroute/negocio_revisado/bpmn/P01_negocio.bpmn` a `P09_negocio.bpmn`. Se conserva esa numeración: P01 confirmar pedidos; P02 preparar jornada; P03 ejecutar entregas; P04 resolver incidencias; P05 evaluar resultados; P06 habilitar recursos; P07 supervisar jornada; P08 administrar accesos; P09 registrar compras. EcoRoute es la herramienta; Dispatcher, Conductor, Administrador y Jefatura logística son personas. Cliente solicitante y receptor intervienen donde corresponde.

Las relaciones RF/RNF expresan el requisito que se pretende aceptar, incluidos soportes parciales de tareas humanas. Los H01–H20 remiten a `docs/plan_correccion_integral.md`; no se crean hallazgos nuevos con IDs ya utilizados. Los nodos de cada caso deben buscarse en `inventario_trazabilidad.json` para obtener archivos, métodos, endpoints y evidencias de línea actuales. No se debe tomar un selector manual, un contrato o una migración como prueba de funcionamiento.

Los recorridos técnicos locales del 20/10/2026 se consultan en `evidencias/regresion_api.json`, `evidencias/comprobaciones_finales_api.json`, `capturas/web/WEB-1792482508091/results.json` y `evidencias/prueba_emulador_offline.json`. La prueba móvil incluye cierre y reapertura sin red, posterior sincronización y contraste de GPS/hashes del pedido sintético 27. Estos informes delimitan escenarios técnicos concretos y no acreditan ejecución de los 96 casos completos por usuarios de la empresa. Deben registrarse por separado: ejecutor agente/persona, fecha, versión, pasos observados, resultado técnico, defectos y enlace a evidencias; y validador humano MICOTRANS, fecha y decisión empresarial. Ninguna firma ni aprobación empresarial se deduce de un resultado PASS técnico.

Para cada caso se requiere captura de UI antes/después, HAR o registro sanitizado de petición/respuesta con código HTTP y correlation ID cuando exista, consulta de BD de solo lectura acotada a los IDs de prueba y, para POD, hashes/metadatos y recuperación del objeto. No guardar contraseñas, JWT, cookies, documentos o fotos reales. Un contador de consola no sustituye evidencia de BD. Los reintentos deben contarse por clave estable de operación y pedido. Registrar las mediciones RNF con repeticiones, carga y percentil; la mera observación visual no demuestra 50/200/500 ms.

Solo ejecutar en entorno de pruebas identificado y con datos sintéticos. Confirmar previamente URL, perfil, BD y bucket/cola de pruebas; no ejecutar operaciones en producción. Sin entorno o interfaz disponible el resultado es bloqueado, nunca aprobado. Si una tarea es externa/manual, adjuntar el registro sintético del acuerdo o decisión y verificar que no se atribuye falsamente a EcoRoute.

## Preparación reproducible y datos sintéticos

El preparador registra IDs reales generados por el entorno: `D-A` y `D-B` (conductores activos vinculados a dos subjects diferentes), `V-A` y `V-B` (vehículos distintos; V-A capacidad 500 kg), `R-A` y `R-B` (rutas distintas del 20/10/2026 America/Lima), `O-A`/`O-B`/`O-C` (pedidos de R-A), `O-X` (pedido de R-B), y `O-L` (pedido PENDING sin ruta). Estos son alias de datos, no IDs hardcodeados. Crear por mecanismos de prueba autorizados/UI; no reutilizar ni borrar datos reales. Reiniciar cada escenario desde sus precondiciones para evitar que un cierre de pedido invalide el siguiente.

Cuentas: `uat.admin`, `uat.dispatcher`, `uat.driver.a`, `uat.driver.b`. El Administrador prepara roles ADMIN, DISPATCHER y DRIVER en el proveedor y verifica vínculo de conductor. Jefatura logística realiza aprobaciones con la cuenta ADMIN autorizada para ese fin, si MICOTRANS acuerda esa correspondencia; se registra la decisión, sin asumir que el cargo ya tiene un rol técnico propio. No escribir contraseñas en el acta.

Pedido base: tracking único `UAT-20261020-xxx`, receptor `Persona Prueba A`, teléfono sintético `900000001`, correo `persona.a@example.test`, dirección `Dirección sintética 101, Lima`, distrito `Distrito Prueba`, latitud -12.095, longitud -77.020. RUC sintético para validación de formato `20999999991`; no acredita existencia tributaria ni consulta SUNAT. DNI sintético del receptor `00000001`; RUC y DNI nunca se intercambian. Condición comercial: `Entregar entre 09:00 y 12:00; receptor de prueba`. Hora base: 20/10/2026 10:00 -05:00; controlar reloj/día de prueba donde el listado móvil usa hoy. No cambiar el reloj de producción.

POD base: fotografía de un paquete de prueba sin personas y firma trazada por el ejecutor como `FIRMA DE PRUEBA`, receptor anterior, coordenada anterior y hora controlada. Preparar foto pequeña válida, foto válida de 10 MB según tamaño admitido por el contrato (registrar bytes exactos), foto de 10 MB + 1 byte y archivo que no sea imagen. No usar el DNI/RUC/imagen de empleados o clientes. Registrar tamaño binario y tamaño del JSON/base64 por separado.

Para P05 usar un conjunto aislado: cuatro pedidos programados en la misma fecha, dos DELIVERED con ventanas conocidas (uno a tiempo y otro tarde), uno FAILED con motivo y uno ASSIGNED; tres con algún archivo POD, dos con POD completo válido, tres con datos completos para IID. RUC/dirección/GPS del cuarto inválidos o ausentes, usando preparación autorizada si la validación impide crearlo por UI. Resultado esperado según contrato actual: IID 75%, CHR 50%, TDE 75%, SUCCESS 50%, ONTIME 50%; POD completo 2 es control de calidad distinto de TDE. Si las reglas de ingreso impiden ese histórico incompleto, importar fixture aislada revisada y documentar su procedencia. No alterar datos operativos para forzar indicadores.

En cada caso el criterio particular se añade a este criterio común obligatorio: pasos completos, UI y backend coherentes, persistencia consultada, ninguna mutación ajena ni duplicación inesperada, evidencias sanitizadas enlazadas y ningún defecto crítico abierto. Si falta uno, no aprobar. Estado inicial de cada caso: no ejecutado; verificación técnica: pending; aceptación humana MICOTRANS: pendiente.

## P01 — Confirmar pedidos

### UAT001 — Registrar pedido sin ruta

Actor: Dispatcher. Precondiciones: sesión DISPATCHER; tracking inexistente. Datos: pedido base con tracking `UAT-20261020-001`, ruta vacía.
Pasos: 1. Abrir `/orders` y el formulario de nuevo pedido. 2. Completar tracking, receptor, contacto, dirección y coordenadas; dejar ruta sin seleccionar. 3. Guardar, buscar por tracking y abrir detalle; recargar navegador.
Resultado esperado UI: un solo pedido visible PENDING, sin ruta y con los datos capturados. Backend: POST `/orders` devuelve el identificador persistido y no crea una ruta. BD: una fila `orders` con `route_id` nulo; conservar el mismo ID después de recargar.
Criterio de aprobación: el pedido queda disponible para P02 sin duplicación ni asignación implícita.
Relación: P01_A9, P01_E4; RF-17, RF-22; RNF-29, RNF-37; H01.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT002 — Datos mínimos y tracking duplicado

Actor: Dispatcher. Precondiciones: existe el tracking del caso anterior en fixture independiente. Datos: tracking vacío; luego el tracking existente y teléfono `abc`.
Pasos: 1. Abrir nuevo pedido y guardar sin tracking/dirección. 2. Corregir campos y probar teléfono inválido. 3. Intentar guardar el tracking existente. 4. Cerrar formulario y consultar listado.
Resultado esperado UI: errores concretos conservan lo capturado y no aparece éxito. Backend: rechaza entrada inválida y duplicado con respuesta de cliente coherente; si la UI bloquea el envío, no debe haber petición. BD: no se agrega fila ni cambia el pedido existente.
Criterio de aprobación: cada rechazo queda demostrado por UI/petición y conteo acotado al tracking.
Relación: P01_A2, P01_G1, P01_A3; RF-17; RNF-18, RNF-37; H01, H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT003 — Dirección no localizada y corrección

Actor: Dispatcher con cliente sintético. Precondiciones: formulario nuevo abierto. Datos: dirección `ZZZ SIN UBICACION UAT`, después dirección base y coordenada conocida.
Pasos: 1. Solicitar localización de la dirección inexistente. 2. Observar mensaje y comprobar que no se declara verificada automáticamente. 3. Aclarar ubicación en registro sintético de contacto, corregirla y guardar. 4. Revisar confirmación comercial antes de asignar.
Resultado esperado UI: diferencia entre ubicación no localizada y dirección verificada por la persona. Backend: conserva coordenadas corregidas y solo registra addressVerified por acción explícita. BD: `orders` y confirmación comercial contienen la ubicación y check elegidos, sin inferir aceptación del geocodificador.
Criterio de aprobación: nunca despachar con coordenadas de respaldo presentadas como dirección verificada.
Relación: P01_A4, P01_G3, P01_A5, P01_G4; RF-18; RNF-18, RNF-37; H04, H14.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT004 — RUC separado del DNI y tres comprobaciones

Actor: Dispatcher. Precondiciones: O-L PENDING con GPS válido; formulario de condiciones disponible. Datos: RUC `20999999991`, tres checks verdaderos y nota comercial base.
Pasos: 1. Abrir O-L y sus datos comerciales. 2. Capturar RUC y nota; marcar aceptación del cliente, dirección verificada y cobertura verificada tras revisar sustento sintético. 3. Guardar y volver a abrir. 4. Revisar posteriormente formulario POD sin copiar RUC al DNI.
Resultado esperado UI: tres checks, nota y RUC recuperables, separados del receptor POD. Backend: PATCH `/orders/{id}/business-data` conserva confirmación e identidad del usuario autenticado; GET la recupera. BD: registro de confirmación de V10 y auditoría vinculados al mismo pedido; no escribe RUC como DNI de `delivery_proofs`.
Criterio de aprobación: el almacenamiento refleja exactamente las tres decisiones y su actor, sin atribuir una firma real al cliente.
Relación: P01_A2, P01_A4, P01_A6, P01_A8b, P01_A9; RF-17, RF-51, RF-75; RNF-29, RNF-37; H01, H10, H18.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT005 — Confirmación incompleta impide continuar

Actor: Dispatcher. Precondiciones: O-L sin confirmación completa. Datos: customerAccepted=false; addressVerified=true; coverageVerified=true; nota válida.
Pasos: 1. Guardar confirmación con aceptación del cliente desmarcada. 2. Intentar vincular O-L a R-A desde la UI disponible. 3. Repetir dejando pendiente, por separado, dirección y cobertura. 4. Consultar revisión de ruta y datos de pedido.
Resultado esperado UI: muestra qué requisito falta y no presenta pedido listo para despacho. Backend: rechaza la operación que exige confirmación completa; registrar exactamente en qué frontera aplica la regla. BD: sin avance indebido ni aprobación válida para un plan incompleto.
Criterio de aprobación: ningún conjunto con un check falso habilita despacho; si la asignación permite borrador, queda explícitamente bloqueada su aprobación/salida.
Relación: P01_G5, P01_G7, P01_A6, P02_A5; RF-19, RF-29; RNF-29; H01, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT006 — Formato RUC y condiciones inválidos

Actor: Dispatcher. Precondiciones: O-L editable. Datos: RUC de 8 dígitos `00000001`, RUC con letras, nota `ok`; después RUC sintético de 11 dígitos y nota válida.
Pasos: 1. Guardar cada variante inválida en datos comerciales. 2. Comprobar mensajes y conservación de valores. 3. Corregir y guardar. 4. Reabrir detalle.
Resultado esperado UI: RUC pide once dígitos y condiciones exigen descripción suficiente. Backend: validación de ConfirmationRequest/BusinessWorkflowService rechaza formatos sin mutaciones parciales. BD: solo la versión válida queda persistida; el DNI de POD permanece independiente.
Criterio de aprobación: no se aceptan identificadores inválidos ni se afirma verificar existencia tributaria por formato.
Relación: P01_A2, P01_G1, P01_A8, P01_A9; RF-17, RF-75; RNF-18, RNF-37; H10, H18.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT007 — Importación CSV con vista previa y fila defectuosa

Actor: Dispatcher. Precondiciones: listado de pedidos accesible; dos tracking nuevos. Datos: CSV con cabecera del contrato actual, una fila válida y otra sin dirección; otro archivo con coma entrecomillada en dirección.
Pasos: 1. Abrir importar CSV y seleccionar archivo. 2. Comparar vista previa con columnas. 3. Importar y revisar respuesta por fila. 4. Corregir el archivo y repetir; buscar ambos tracking. 5. Probar la dirección con coma.
Resultado esperado UI: informa filas aceptadas/rechazadas y no promete importación completa si fue parcial. Backend: parser respeta el formato anunciado y devuelve error identificable por fila; registrar limitación si divide por coma sin soporte de comillas. BD: no duplica filas válidas al reintentar; ninguna fila incompleta se presenta como validada comercialmente.
Criterio de aprobación: conteos UI/backend/BD coinciden y el contrato CSV real está documentado; defecto del parser bloquea ese subcaso.
Relación: P01_A2, P01_A9; RF-20; RNF-14, RNF-18; H01, H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT008 — Cliente desiste o no corrige a tiempo

Actor: Dispatcher con cliente sintético. Precondiciones: solicitud aún sin pedido aceptado; canal/registro comercial de prueba identificado. Datos: solicitud `SOL-UAT-008`, plazo vencido y respuesta de desistimiento sintética.
Pasos: 1. Registrar solicitud y datos faltantes en el medio que usa el negocio. 2. Solicitar corrección y dejar vencer plazo simulado. 3. En otra variante, proponer alternativa y recibir rechazo. 4. Comprobar que ninguna variante aparece lista para P02.
Resultado esperado UI: si no hay expediente de solicitudes, dejar brecha explícita; no crear estado ficticio en pedidos. Backend: no debe generar ruta/despacho ni aceptación automática. BD: ninguna asignación/confirmación positiva sin sustento; acta externa enlaza solicitud y decisión cuando corresponda.
Criterio de aprobación: Dispatcher demuestra ambos finales con evidencia del canal humano; carencia de registro trazable se marca bloqueado.
Relación: P01_G2, P01_E1, P01_A7, P01_G6, P01_E3; RF-17; RNF-29; H10.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT009 — Buscar, filtrar y conservar detalle correcto

Actor: Dispatcher. Precondiciones: 12 pedidos de prueba con estados diferentes. Datos: tracking `UAT-20261020-009`, filtro PENDING y texto sin coincidencias `SIN-RESULTADOS-UAT`.
Pasos: 1. Buscar el tracking y abrir detalle. 2. Aplicar estado PENDING y avanzar página. 3. Introducir texto sin resultados. 4. Limpiar filtros y recargar; abrir de nuevo el pedido.
Resultado esperado UI: filtros combinados, paginación coherente y vacío distinguible de error; detalle corresponde al ID seleccionado. Backend: distinguir filtrado local de query remota en evidencia; lectura sin mutación. BD: ningún cambio de estados, ruta o confirmación.
Criterio de aprobación: nunca mostrar detalle obsoleto de otro pedido tras filtrar o recargar.
Relación: P01_A2, P01_A9; RF-21, RF-22; RNF-19, RNF-20; H01, H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## P02 — Preparar la jornada de reparto

### UAT010 — Crear ruta con conductor, vehículo y fecha

Actor: Dispatcher. Precondiciones: D-A/V-A activos sin ruta del día. Datos: fecha 20/10/2026, inicio 09:00 -05:00.
Pasos: 1. Abrir `/routes`, nueva ruta. 2. Seleccionar D-A, V-A, fecha e inicio. 3. Guardar y filtrar por fecha/PLANNED. 4. Abrir la ruta y recargar.
Resultado esperado UI: una ruta PLANNED con recursos e inicio correctos. Backend: POST `/routes` devuelve ID y conserva la fecha operativa. BD: una fila `routes`, sin despacho ni pedidos inventados.
Criterio de aprobación: los valores persisten sin desplazamiento de día por conversión UTC.
Relación: P02_A2, P02_A4; RF-26, RF-28; RNF-29; H13, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT011 — Vincular pedido existente sin duplicarlo

Actor: Dispatcher. Precondiciones: O-L PENDING confirmado; R-A PLANNED. Datos: IDs de O-L/R-A y conteo previo por tracking.
Pasos: 1. Abrir O-L y seleccionar la acción de asignar a R-A. 2. Confirmar una vez. 3. Repetir la misma selección si la UI lo permite. 4. Revisar listado de ruta y detalle del pedido.
Resultado esperado UI: el mismo pedido aparece asignado una vez; no exige volver a crear sus datos. Backend: PATCH `/orders/{id}/route` usa ID existente y responde coherentemente al reintento. BD: mismo `orders.id`, una sola fila por tracking, route_id=R-A y estado previsto por dominio.
Criterio de aprobación: ID y conteo se conservan; falta de control UI conectado queda bloqueada aunque exista endpoint.
Relación: P02_A5, P02_G2, P02_A6; RF-19, RF-23; RNF-29; H01.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT012 — Conflicto de conductor o vehículo

Actor: Dispatcher. Precondiciones: R-A activa para D-A/V-A en la fecha. Datos: nueva ruta del mismo día con D-A/V-B; luego D-B/V-A.
Pasos: 1. Intentar crear cada combinación conflictiva desde nueva ruta. 2. Leer error y corregir recursos o fecha. 3. Guardar variante sin conflicto. 4. Revisar ambas rutas.
Resultado esperado UI: mensaje identifica el recurso ocupado y conserva formulario. Backend: conflicto de negocio documentado, esperado 409 si ese es el contrato vigente. BD: ninguna segunda ruta activa con el recurso/fecha en conflicto; variante válida sí persiste.
Criterio de aprobación: control de servidor efectivo, incluido reintento concurrente de dos usuarios de prueba.
Relación: P02_A2, P02_G1, P02_A3; RF-27; RNF-29; H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT013 — Revisar recorrido, orden y alternativa de ruteo

Actor: Dispatcher. Precondiciones: R-A con tres pedidos confirmados de coordenadas distintas. Datos: motor OSRM de pruebas disponible; luego indisponible de forma controlada.
Pasos: 1. Seleccionar R-A y abrir mapa/recorrido. 2. Registrar IDs de paradas, polilínea, kilómetros y minutos. 3. Comparar con la ruta móvil; desplazar origen simulado del conductor y solicitar recorrido pendiente, comprobando paradas numeradas y distancia/tiempo en ambas interfaces. 4. Indisponer solo el motor de pruebas y volver a calcular. 5. Restaurarlo.
Resultado esperado UI: orden visible y origen aproximado identificable si se usa fallback. Backend: GET `/routes/{id}/path` devuelve visita/medidas/fuente sin espera ilimitada. BD: no se atribuye persistencia a un cálculo de lectura; comprobar por separado `stop_sequence` y geometría guardada si la operación de planificación los escribe.
Criterio de aprobación: web/móvil coinciden y nunca se presenta línea aproximada como red vial calculada.
Relación: P02_A7, P02_A9, P03_A1; RF-33, RF-34, RF-35, RF-36, RF-37, RF-39; RNF-02, RNF-06, RNF-25; H14.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT014 — Aprobar plan con peso dentro y fuera de capacidad

Actor: Jefatura logística usando ADMIN autorizado. Precondiciones: R-A PLANNED, pedidos confirmados, V-A capacidad 500 kg, D-A activo. Datos: pesos 499, 500 y 501 kg; nota `Plan revisado UAT014`.
Pasos: 1. Abrir revisión de plan. 2. Marcar controles de capacidad, ventanas y vehículo. 3. Intentar aprobar con 501 kg. 4. Aprobar fixture equivalente con 500 kg; repetir con 499 kg. 5. Reabrir revisión.
Resultado esperado UI: rechaza sobrecarga y conserva aprobación válida con actor/fecha. Backend: POST `/routes/{id}/review` exige ADMIN, verificaciones y peso positivo <= capacityKg; no aprueba ruta vacía/incompleta. BD: revisión V10 y auditoría contienen peso/actor; rechazo no deja aprobación vigente.
Criterio de aprobación: frontera exacta 500 aceptada y 501 rechazada con evidencia; no inferir capacidad a partir del número de pedidos.
Relación: P02_A8, P02_G3, P02_A10; RF-26, RF-29; RNF-29, RNF-34; H15, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT015 — Conductor acepta su hoja aprobada

Actor: Conductor D-A. Precondiciones: R-A aprobada y asignada a D-A; R-B ajena. Datos: las dos rutas.
Pasos: 1. Entrar en móvil con `uat.driver.a`. 2. Abrir hoja/revisión de R-A y comprobar carga/vehículo. 3. Aceptar y reabrir. 4. Con la segunda cuenta intentar aceptar R-A por su interfaz de prueba autorizada. 5. Probar aceptar una ruta aún sin aprobación.
Resultado esperado UI: permite aceptación propia aprobada y explica los rechazos. Backend: POST `/routes/{id}/acceptance` obtiene conductor desde sesión, exige DRIVER, propiedad y aprobación previa. BD: acceptedBy/acceptedAt reflejan D-A una sola vez; negativas no escriben aceptación ajena.
Criterio de aprobación: ninguna cuenta ADMIN/Dispatcher puede suplantar aceptación del conductor mediante datos cliente.
Relación: P02_A11, P02_A12, P02_G4; RF-38, RF-29; RNF-34; H02, H15, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT016 — Reasignar invalida aprobación y aceptación

Actor: Dispatcher, Jefatura y Conductor. Precondiciones: rutas R-A/R-B PLANNED con revisiones aprobadas y aceptadas; pedido reasignable. Datos: O-L confirmado; notas de revisión distintas.
Pasos: 1. Registrar revisiones vigentes y sus actores. 2. Reasignar pedido a otra ruta. 3. Reabrir ambas revisiones. 4. Intentar despachar ambas sin revisar de nuevo. 5. Reaprobar y volver a aceptar donde corresponda.
Resultado esperado UI: muestra revisiones invalidadas y exige repetir los pasos personales. Backend: asignación invalida las revisiones afectadas; despacho rechaza revisión/aceptación obsoleta. BD: flags/fechas de revisión coherentes y auditoría de cambio, sin duplicar pedido.
Criterio de aprobación: ni aprobación ni aceptación previa habilitan un plan modificado; documentar si la versión limita reasignación a PENDING y preparar la fixture compatible.
Relación: P02_A5, P02_A6, P02_A10, P02_A12, P02_A14; RF-19, RF-29; RNF-29, RNF-31; H01, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT017 — Despacho válido y cascada atómica

Actor: Dispatcher. Precondiciones: R-A PLANNED, al menos dos pedidos válidos, aprobación y aceptación vigentes. Datos: IDs y estados previos.
Pasos: 1. Abrir R-A y accionar iniciar despacho una vez. 2. Observar ruta y pedidos. 3. Recargar web y móvil. 4. En fixture separada simular fallo transaccional de pruebas durante cascada y consultar resultado.
Resultado esperado UI: R-A IN_PROGRESS y pedidos IN_TRANSIT; ante fallo no informa éxito parcial. Backend: PATCH estado ejecuta transición y cascada en una transacción o rechaza completamente. BD: ruta/inicio/pedidos cambian juntos; el fallo preparado revierte todo.
Criterio de aprobación: cero mezcla PLANNED/IN_TRANSIT por fallo parcial; la simulación técnica debe adjuntarse como evidencia separada del recorrido humano.
Relación: P02_A14, P02_E4; RF-29, RF-30; RNF-31; H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT018 — Bloquear despacho vacío, sin revisión o sin aceptación

Actor: Dispatcher. Precondiciones: tres fixtures: ruta vacía; ruta con pedidos sin aprobar; ruta aprobada sin aceptación. Datos: IDs de las tres rutas.
Pasos: 1. Abrir cada ruta y solicitar despacho. 2. Anotar la condición faltante informada. 3. Completar la condición en una fixture válida y repetir. 4. Recargar tras cada intento.
Resultado esperado UI: cada negativa indica qué falta; no oculta la ruta. Backend: rechaza cada transición inválida; solo la fixture completa entra en progreso. BD: sin inicio real ni cambios de pedidos en los rechazos.
Criterio de aprobación: las tres fronteras se aplican en servidor y el usuario puede recuperar el flujo corrigiendo datos.
Relación: P02_G2, P02_E2, P02_G4, P02_E3, P02_A14; RF-29, RF-30; RNF-29, RNF-31; H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## P03 — Ejecutar entregas

### UAT019 — Ver solo rutas y pedidos propios del día

Actor: Conductor D-A. Precondiciones: R-A propia de hoy en progreso, R-B ajena y otra ruta propia de mañana. Datos: O-A y O-X.
Pasos: 1. Iniciar sesión móvil D-A y abrir rutas. 2. Elegir R-A y ver paradas. 3. Comparar con cuenta D-B. 4. Intentar abrir enlace/detalle de O-X desde una entrada de prueba controlada.
Resultado esperado UI: solo operación propia elegible y mensaje de acceso para datos ajenos. Backend: filtra por identidad real y fecha operativa, rechaza acceso directo ajeno. BD: consultas no modifican pedidos, rutas ni pertenencias.
Criterio de aprobación: ausencia de datos ajenos tanto en UI como en respuesta de red, sin usar driverId fijo.
Relación: P03_A1, P02_E4; RF-38, RF-41, RF-42; RNF-34; H02, H13.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT020 — Capturar POD completo y cerrar entrega

Actor: Conductor y receptor de prueba. Precondiciones: O-A IN_TRANSIT propia, conexión disponible, permisos concedidos. Datos: POD base.
Pasos: 1. Abrir O-A y seleccionar entrega. 2. Tomar foto, trazar firma y capturar nombre/DNI. 3. Verificar GPS/hora mostrados y confirmar una vez. 4. Abrir historial y el detalle web.
Resultado esperado UI: confirma persistencia remota y pasa a solo lectura; foto/firma corresponden a las capturadas. Backend: POST POD valida, guarda objetos y cierra pedido de forma coherente. BD: `delivery_proofs` ligado a O-A, GPS/hora/receptor íntegros, `orders` DELIVERED y metadatos de integridad/auditoría.
Criterio de aprobación: evidencia recuperable y una sola entrega; un mensaje local de éxito no basta.
Relación: P03_A6, P03_A8, P03_A11, P03_A13; RF-48, RF-50, RF-51, RF-52, RF-53, RF-54; RNF-39; H03, H04, H19.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT021 — Foto, firma o receptor faltantes

Actor: Conductor. Precondiciones: pedido propio IN_TRANSIT editable. Datos: cuatro variantes: sin foto, sin firma, nombre vacío, DNI de siete dígitos.
Pasos: 1. Completar formulario excepto un componente por variante. 2. Intentar guardar. 3. Revisar mensaje específico y datos conservados. 4. Corregir todos los campos y completar una entrega válida.
Resultado esperado UI: no presenta éxito ni sustituye nombre/DNI por valores ficticios. Backend: exige componentes obligatorios aun con cliente alterado mediante herramienta de pruebas; rechaza entradas incompletas. BD: negativos no crean prueba/cierre/evento.
Criterio de aprobación: cada componente incompleto bloquea DELIVERED en servidor, sin firma pixel ni DNI por defecto.
Relación: P03_G4, P03_A9, P03_A10, P03_E4; RF-49, RF-50, RF-51, RF-54; RNF-37, RNF-39; H03, H19.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT022 — Cámara cancelada o permiso denegado

Actor: Conductor. Precondiciones: móvil de pruebas con permisos de cámara revocados, pedido editable. Datos: POD base sin fotografía.
Pasos: 1. Pulsar tomar foto y denegar permiso. 2. Volver al detalle; cancelar un segundo intento. 3. Conceder permiso desde ajustes de prueba. 4. Capturar foto y continuar.
Resultado esperado UI: explica permiso/cancelación y preserva nombre/firma; no cierra pedido ni usa imagen anterior equivocada. Backend: no recibe POD incompleto en intentos cancelados. BD: permanece IN_TRANSIT hasta confirmación válida.
Criterio de aprobación: recuperación sin reiniciar formulario ni pérdida silenciosa de evidencia.
Relación: P03_A8, P03_A9; RF-48, RF-49; RNF-18; H03, H19.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT023 — GPS denegado, cero o fuera de rango

Actor: Conductor. Precondiciones: pedido propio editable; control de permisos/ubicación solo de pruebas. Datos: GPS ausente; (0,0); latitud 91; luego (-12.095,-77.020).
Pasos: 1. Preparar POD con permiso denegado y observar bloqueo/pendiente. 2. Probar coordenadas inválidas con apoyo técnico local. 3. Recuperar una lectura válida y guardar. 4. Comparar captura local y BD.
Resultado esperado UI: distingue GPS no disponible de ubicación válida; nunca anuncia verificación con (0,0). Backend: rechaza coordenadas inválidas y conserva coordenadas capturadas sin sustituirlas. BD: solo POD válido cierra pedido y registra latitud/longitud/hora reales de prueba.
Criterio de aprobación: lat/lon válidas coinciden extremo a extremo y el dato ausente no se transforma en cero válido.
Relación: P03_A8, P03_G4, P03_A9; RF-52; RNF-37, RNF-39; H04, H07.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT024 — Entrega offline persiste tras reiniciar

Actor: Conductor. Precondiciones: pedidos propios descargados, outbox disponible y almacenamiento de pruebas. Datos: POD base para O-A, red apagada solo en dispositivo de prueba.
Pasos: 1. Abrir O-A con red, luego activar modo avión. 2. Capturar y confirmar POD. 3. Abrir pantalla de sincronización y anotar operación pendiente. 4. Cerrar forzosamente la app y abrirla sin red. 5. Revisar cola y archivos.
Resultado esperado UI: identifica pendiente local, sin afirmar aceptación remota; conserva foto/firma y datos al reiniciar. Backend: no recibe operación mientras no hay red. BD: pedido remoto aún no cierra; almacenamiento local mantiene operación y archivos vinculados.
Criterio de aprobación: la cola sobrevive al reinicio y no pierde/cambia datos; sin integración efectiva de outbox el caso queda bloqueado.
Relación: P03_A8, P03_A12, P03_E5; RF-43, RF-48, RF-54; RNF-07, RNF-29; H05.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT025 — Reconectar y reintentar sin duplicar POD

Actor: Conductor. Precondiciones: POD pendiente del caso offline; misma clave de operación preservada. Datos: O-A; corte controlado tras recepción servidor y antes de respuesta cliente.
Pasos: 1. Restablecer red y solicitar sincronización. 2. Simular pérdida de la respuesta en una fixture técnica local. 3. Reintentar y volver a abrir sincronización. 4. Consultar entrega en web y cola.
Resultado esperado UI: pasa pendiente/enviando/confirmado de forma comprensible; reintento no crea segunda entrega. Backend: reconoce misma operación/POD y devuelve resultado coherente. BD: una prueba y un efecto de entrega, historial/outbox de servidor sin duplicados de negocio; cola local borra solo tras confirmación durable.
Criterio de aprobación: conteos/hash del POD y clave idempotente demuestran efecto único incluso con respuesta perdida.
Relación: P03_A12, P03_A11, P03_A13; RF-53, RF-54, RF-60; RNF-29; H05, H12.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT026 — Pedido final no se edita ni se entrega dos veces

Actor: Conductor y Dispatcher. Precondiciones: O-A DELIVERED y O-B FAILED en fixtures separadas. Datos: intento de cambiar estado/receptor/foto.
Pasos: 1. Abrir ambos detalles en móvil y web. 2. Intentar editar campos o guardar estado final otra vez. 3. Con apoyo técnico probar cambio de estado fuera de UI. 4. Consultar estado e historial.
Resultado esperado UI: solo lectura y motivo claro; un reintento idéntico de sincronización se distingue de edición nueva. Backend: bloquea reapertura/mutación incompatible; no permite DELIVERED manual sin POD. BD: valores finales y evidencia original no cambian, sin segundo cierre.
Criterio de aprobación: regla aplicada también por servidor, con reintento idempotente seguro.
Relación: P03_A13, P03_G7; RF-23, RF-44; RNF-24; H03, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT027 — Recuperar foto, firma y comprobante PDF

Actor: Dispatcher y Conductor propio. Precondiciones: O-A con POD completo y objetos persistidos. Datos: tracking O-A y hashes de foto/firma.
Pasos: 1. Abrir evidencia en detalle e historial permitido. 2. Descargar foto, firma y PDF por los controles disponibles. 3. Abrir archivos y comparar receptor, tracking, hora e imagen. 4. Repetir tras reiniciar servicios locales de prueba sin borrar volúmenes.
Resultado esperado UI: archivos legibles y acceso claro a error si falta objeto. Backend: endpoints de foto/firma/PDF autorizan propiedad y recuperan el objeto correcto; PDF incluye evidencia real. BD: metadatos/hashes se conservan; bucket de pruebas mantiene archivos tras reinicio.
Criterio de aprobación: mismo contenido y vínculo después del reinicio; si el móvil no ofrece descarga, registrar brecha del control concreto.
Relación: P03_A11, P03_A13; RF-25, RF-45, RF-53, RF-55; RNF-12, RNF-39; H11, H19.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## P04 — Resolver incidencias

### UAT028 — Registrar ausencia con motivo específico

Actor: Conductor. Precondiciones: pedido propio IN_TRANSIT, receptor de prueba ausente. Datos: motivo `UAT028: receptor ausente a las 10:15`.
Pasos: 1. Abrir pedido, elegir resultado no entregado. 2. Capturar motivo específico y guardar. 3. Abrir detalle web del Dispatcher. 4. Consultar historial con apoyo del preparador.
Resultado esperado UI: muestra motivo y situación pendientes/cerradas según transición real. Backend: recibe el motivo escrito, sin reemplazarlo por texto genérico de app. BD: `order_status_history` conserva motivo, identidad autenticada y fecha; `orders` refleja transición permitida.
Criterio de aprobación: mismo motivo aparece en evidencia de cliente, respuesta y persistencia.
Relación: P03_A5, P03_E2, P04_A1; RF-23, RF-78; RNF-18; H10.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT029 — Motivo vacío no cierra un fallo

Actor: Conductor o Dispatcher autorizado. Precondiciones: pedido propio en tránsito. Datos: motivo vacío, espacios y luego `Acceso bloqueado en prueba UAT029`.
Pasos: 1. Intentar estado de fallo con cada motivo inválido. 2. Observar error y conservar formulario. 3. Escribir motivo válido y confirmar. 4. Revisar auditoría.
Resultado esperado UI: exige razón concreta y no anuncia fallo cerrado antes de guardar. Backend: rechaza motivos ausentes incluso con petición directa de prueba. BD: sin historial/cierre para intentos inválidos; una transición válida con actor/fecha.
Criterio de aprobación: ninguna vía permite FAILED sin motivo trazable.
Relación: P04_A1, P04_A8, P04_E3; RF-78; RNF-37; H03, H10.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT030 — Rechazo del receptor con evidencia

Actor: Conductor y Dispatcher. Precondiciones: receptor sintético rechaza bulto; pedido en tránsito. Datos: `UAT030: receptor rechaza paquete de prueba por embalaje` y foto sin personas.
Pasos: 1. Registrar rechazo y sustento por controles reales. 2. Dispatcher abre incidencia y solicita revisión. 3. Confirmar decisión en el registro disponible. 4. Consultar datos desde ambas interfaces.
Resultado esperado UI: rechazo diferenciado de entrega exitosa; si no hay adjunto/expediente de incidencia se declara carencia. Backend: no usa creación de POD DELIVERED para guardar rechazo. BD: estado/motivo y evidencia de incidencia solo si existe contrato real; ninguna prueba exitosa ficticia.
Criterio de aprobación: trazabilidad del rechazo sin convertir sustento en entrega; registro externo se identifica como tal.
Relación: P03_A7, P03_E3, P04_A1, P04_A2; RF-23, RF-78; RNF-39; H03, H10.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT031 — Solicitar complemento y mantener observación

Actor: Dispatcher y Conductor. Precondiciones: sustento de incidencia incompleto; pedido sin cierre exitoso. Datos: solicitud `Falta causa y fotografía UAT031`.
Pasos: 1. Revisar evidencia incompleta. 2. Pedir complemento por canal de prueba identificado. 3. Registrar respuesta insuficiente. 4. Revisar que no se cierra como entregado ni resuelto.
Resultado esperado UI: observación pendiente y canales externos claramente identificados. Backend: no genera resolución positiva por existencia de archivo. BD: conserva estado permitido y vínculos de sustento; si no existe expediente, el caso queda bloqueado y la nota externa no se presenta como fila de BD.
Criterio de aprobación: el seguimiento muestra responsable y pendiente verificables; ausencia de soporte se reporta, no se simula.
Relación: P04_A2, P04_G1, P04_A3, P04_A4; RF-78; RNF-18, RNF-39; H05, H10.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT032 — Reintento autorizado de una parada

Actor: Dispatcher, Jefatura y Conductor. Precondiciones: incidencia OPEN sobre pedido FAILED/RETURNED confirmado; ruta original aún IN_PROGRESS con otras paradas pendientes. Datos: acuerdo `Reintento UAT032 a las 11:00`.
Pasos: 1. Evaluar impacto y registrar autorización humana. 2. En `/incidents`, resolver con RETRY y razón concreta. 3. Identificar nuevo pedido/seguimiento enlazado al original. 4. Conductor realiza el nuevo intento y entrega con POD completo. 5. Repetir resolución para comprobar efecto único.
Resultado esperado UI: muestra el nuevo intento y conserva resultado fallido original. Backend: BusinessOperationsService.resolve exige estado/confirmación/ruta compatibles y crea pedido nuevo IN_TRANSIT con tracking nuevo; no reabre pedido terminal. BD: `order_attempts` enlaza original, retry e incidencia una sola vez; original permanece terminal; POD pertenece al nuevo intento.
Criterio de aprobación: permiso explícito, historia intacta y un nuevo intento vinculado, sin confundir creación intencional con duplicación accidental.
Relación: P04_A5, P04_A6, P04_E1, P03_A1; RF-23, RF-43, RF-78; RNF-24, RNF-29; H03, H10, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT033 — Reprogramar a nueva jornada

Actor: Dispatcher con cliente sintético. Precondiciones: incidencia OPEN de pedido FAILED/RETURNED confirmado y nueva ruta PLANNED. Datos: nueva fecha 21/10/2026 y acuerdo `UAT033 nueva ventana 09:00-12:00`.
Pasos: 1. Registrar acuerdo de fecha. 2. Resolver incidencia con REPLAN, razón y ruta destino. 3. Revisar pedido original y nuevo intento. 4. Comprobar confirmación y ventana del nuevo intento; registrar nueva promesa por control disponible. 5. Repetir aprobación de plan y aceptación de hoja antes de despachar.
Resultado esperado UI: explica que existe nuevo intento vinculado, no una reapertura del histórico. Backend: crea pedido ASSIGNED en ruta PLANNED, invalida revisión destino y no reutiliza silenciosamente ventana vencida ni aceptación comercial anterior. BD: `order_attempts` conserva relación; original mantiene resultado; nuevo tracking/reference y confirmación pendiente distinguibles.
Criterio de aprobación: handoff P04→P02 con historia intacta y nueva aceptación/ventana comprobables; ausencia de control para nueva promesa queda brecha explícita.
Relación: P04_A7, P04_E2, P02_A5; RF-19, RF-23, RF-28, RF-78; RNF-29; H01, H10, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT034 — Cierre fallido autorizado y cierre de ruta

Actor: Jefatura logística y Dispatcher. Precondiciones: última parada no entregable; otras paradas terminales. Datos: motivo `UAT034 cierre por imposibilidad confirmada` y decisión humana documentada.
Pasos: 1. Revisar alternativas y autorización. 2. Registrar primero resultado final de no entrega con motivo. 3. Resolver incidencia con CLOSE_FAILED desde cuenta ADMIN autorizada. 4. Abrir ruta/tablero y consultar historial/cierre; intentar resolución definitiva con Dispatcher para verificar rechazo.
Resultado esperado UI: fallo visible sin POD exitoso; ruta se completa cuando todas sus paradas son terminales. Backend: resolución definitiva exige ADMIN y resultado terminal previo distinto de DELIVERED; cierre de ruta usa definición uniforme de finales. BD: pedido FAILED con razón/actor/fecha, incidencia resuelta y ruta cerrada una vez, sin marcar fallo como DELIVERED.
Criterio de aprobación: autorización humana distinguida del cierre técnico y denominadores analíticos conservan fallo.
Relación: P04_A8, P04_E3, P03_E6, P05_A1; RF-31, RF-78; RNF-29; H10, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT035 — Conductor no resuelve incidencia ajena

Actor: Conductor D-A. Precondiciones: O-X pertenece a D-B. Datos: ID ajeno y motivo `UAT035 intento no autorizado`.
Pasos: 1. Buscar O-X en la UI propia. 2. Intentar enlace de detalle preparado para prueba. 3. Con apoyo técnico reproducir cambio de estado/POD sobre O-X. 4. D-B revisa su pedido.
Resultado esperado UI: dato ajeno no disponible y error de autorización comprensible. Backend: rechaza lectura/escritura ajena usando identidad del token. BD: O-X y sus evidencias/historial no cambian.
Criterio de aprobación: ninguna manipulación de IDs suple propiedad ni crea auditoría como D-B.
Relación: P04_A1, P04_A8; RF-06, RF-43; RNF-34, RNF-35; H02, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT036 — Incidencia offline y estado pendiente visible

Actor: Conductor y Dispatcher. Precondiciones: parada con impedimento y dispositivo sin red. Datos: motivo específico y sustento de prueba.
Pasos: 1. Registrar impedimento sin conexión. 2. Verificar si el producto soporta esa operación offline o la bloquea con mensaje. 3. Reiniciar app, restablecer red y revisar recuperación. 4. Confirmar con Dispatcher recepción real.
Resultado esperado UI: nunca anuncia recepción remota estando offline; conserva borrador/cola si esa función está soportada. Backend: al reconectar acepta una sola operación con motivo original. BD: sin cambios mientras está offline; al confirmar queda un registro coherente. Outbox exclusiva de POD no se presume compatible con incidencias.
Criterio de aprobación: comportamiento y limitaciones explícitos, sin pérdida silenciosa; ausencia de persistencia requerida se registra como defecto.
Relación: P03_A3, P03_E1, P04_A1; RF-43, RF-78; RNF-07, RNF-18; H05, H10.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## P05 — Evaluar resultados

### UAT037 — Misma población y fechas en tablero y reportes

Actor: Jefatura con acceso ADMIN y Dispatcher al tablero permitido. Precondiciones: fixture analítica aislada de cuatro pedidos. Datos: D-A, 20/10/2026 a 20/10/2026.
Pasos: 1. Aplicar mismo conductor/rango en `/dashboard` y `/reports`. 2. Registrar conteos por estado, total y a tiempo/tarde. 3. Comparar respuestas API y consulta de BD acotada. 4. Cambiar a D-B sin datos y repetir.
Resultado esperado UI: paneles comparten población y filtros; vacío no se representa como fallo de red. Backend: aplica driverId/startDate/endDate según `analytics_api_contract.json`. BD: lectura sin mutación y total consistente con fecha de ruta/fecha local de creación para no asignados.
Criterio de aprobación: cada conteo se reconcilia con las cuatro filas de fixture y no hay filtros solo decorativos.
Relación: P05_A1, P05_A3; RF-63, RF-64, RF-65, RF-68, RF-69; RNF-20; H09, H13.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT038 — Cinco indicadores y denominadores explícitos

Actor: Jefatura logística con acceso autorizado. Precondiciones: fixture analítica descrita arriba. Datos: IID 3/4, CHR 2/4, TDE 3/4, SUCCESS 2/4, ONTIME 1/2.
Pasos: 1. Abrir BI del reporte. 2. Leer código/nombre, numerador, denominador y porcentaje de cada KPI. 3. Comparar con respuesta GET `/reports/bi` y datos fuente. 4. Diferenciar TDE de POD completo.
Resultado esperado UI: 75%, 50%, 75%, 50%, 50% respectivamente con fórmula explicada; dos POD completos se muestran como calidad, sin redefinir TDE. Backend: contrato incluye los cinco códigos y base calculable. BD: consultas/vistas usan la población acordada sin duplicación por joins.
Criterio de aprobación: las cinco fracciones coinciden, y las definiciones históricas distintas no se presentan como comparación causal.
Relación: P05_A3, P05_A4; RF-75, RF-80, RF-81; RNF-15; H09, H18.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT039 — Sin población ni denominador

Actor: Jefatura con acceso al reporte. Precondiciones: rango sin pedidos ni rutas o fixture sin ventanas de entrega. Datos: 01/01/2099 a 02/01/2099; ONTIME sin ventana.
Pasos: 1. Filtrar periodo vacío. 2. Abrir los cinco KPI y tendencia. 3. Cambiar a fixture con entregas sin ventana. 4. Intentar exportar y leer aviso.
Resultado esperado UI: NO_DATA/no disponible según contrato, sin NaN/Infinity ni 100% inventado; ONTIME sin base queda nulo. Backend: denominador cero produce percentage=null. BD: ninguna inserción/alteración de metas por una consulta vacía.
Criterio de aprobación: vacío, cero real y dato no disponible son distinguibles para el usuario.
Relación: P05_A1, P05_A3, P05_E1; RF-75, RF-76; RNF-18; H09, H18.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT040 — Distrito nulo y exportación consistente

Actor: Administrador autorizado a reportes. Precondiciones: fixture con distrito nulo y otro con tilde/coma. Datos: `null`, `Distrito Prueba`, `Prueba, Lima`.
Pasos: 1. Abrir distribución por distrito y reporte con filtro. 2. Confirmar grupo sin distrito. 3. Exportar CSV mediante botón real. 4. Abrir CSV en lector de texto y hoja de cálculo de pruebas; comparar filas/total con el panel.
Resultado esperado UI: grupo sin distrito legible y exportación del conjunto filtrado. Backend: agregaciones no fallan por nulo y no pierden registros. BD: distrito original no se rellena silenciosamente al leer/exportar; filas/valores coinciden.
Criterio de aprobación: CSV correcto en delimitadores/acentos y sin contradicción de contrato si la eficiencia actual es por ruta en vez de distrito.
Relación: P05_A1, P05_A3; RF-66, RF-69, RF-70; RNF-15; H08, H09.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT041 — Configurar y quitar meta con auditoría

Actor: Jefatura mediante ADMIN autorizado. Precondiciones: BI accesible, meta previa conocida. Datos: IID target=80; luego null; negativos -1 y 101.
Pasos: 1. Abrir configuración de meta IID y guardar 80. 2. Recargar y observar brecha contra 75%. 3. Intentar -1/101. 4. Quitar meta con control real y revisar historial.
Resultado esperado UI: brecha -5, BELOW_TARGET; sin meta NO_TARGET. Backend: PUT `/reports/goals/IID` valida 0..100 o null, obtiene actor autenticado y GET recupera valor. BD: meta e historial inmutable con actor/fecha; inválidos no reemplazan valor válido.
Criterio de aprobación: persiste tras recarga y ninguna meta por defecto se presenta como aprobación empresarial.
Relación: P05_A4; RF-77; RNF-29, RNF-34; H18, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT042 — Tendencia y medianoche de Lima

Actor: Jefatura con acceso a BI. Precondiciones: fixture con registros alrededor de medianoche operativa. Datos: 21/10/2026 04:59:59Z (=20/10 23:59:59 Lima) y 05:00:00Z (=21/10 00:00).
Pasos: 1. Filtrar 20/10 y luego 21/10. 2. Revisar tendencia y conteos. 3. Comparar pedidos sin ruta con pedidos que tienen route_date explícita. 4. Exportar cada rango.
Resultado esperado UI: días y filtros consistentes con America/Lima. Backend: usa fecha de ruta cuando existe y fecha de creación convertida cuando falta, conforme al contrato. BD: misma pertenencia temporal en vistas/consultas, sin doble conteo.
Criterio de aprobación: ambas fronteras de fecha se reconcilian y la tendencia aclara que las metas aplicadas son las configuradas actuales.
Relación: P05_A3, P05_A4; RF-68, RF-76; RNF-20; H09, H13.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT043 — Causas, kilómetros y tiempo por parada

Actor: Jefatura logística. Precondiciones: ruta con dos puntos GPS válidos y tiempos reales; otra sin GPS/inicio; dos eventos de motivo del mismo pedido. Datos: coordenadas controladas y motivos distintos.
Pasos: 1. Abrir causas y eficiencia por ruta. 2. Verificar fuente STATUS_HISTORY/INCIDENT. 3. Comparar kilómetros Haversine con puntos ordenados. 4. Revisar ruta sin GPS. 5. Contrastar tiempo operativo/paradas terminales.
Resultado esperado UI: causas cuentan eventos según contrato; GPS ausente produce no disponible y no kilómetros planificados etiquetados como reales. Backend: LAG GPS por vehículo/intervalo y mínimo de muestras válido. BD: lecturas sin duplicar trayectos ni eventos por joins.
Criterio de aprobación: unidad/fuente y denominador visibles; tiempo operativo por parada no se vende como tiempo de atención medido.
Relación: P05_A3, P05_A6; RF-79, RF-80; RNF-15; H07, H09, H18.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT044 — Acción de mejora y cierre humano

Actor: Jefatura y Dispatcher. Precondiciones: desviación identificada en periodo sintético y vista Acciones P05 disponible. Datos: acción `UAT044 revisar ventanas`, responsable de prueba, métrica IID, base 75, meta 80 y plazo 22/10/2026.
Pasos: 1. Revisar causa y crear acción en `/bi`, Acciones P05. 2. Intentar verificar directamente desde OPEN y sin resultado medido. 3. Pasar a IN_PROGRESS con nota. 4. Registrar resultado observado 85 y justificar; verificar con ADMIN autorizado. 5. Intentar cambiar acción ya cerrada y verificar que Dispatcher no puede verificar ni descartar.
Resultado esperado UI: muestra responsable/plazo, base/meta declaradas, seguimiento y resultado, distintos de indicadores operativos calculados. Backend: createAction/updateAction valida textos/valores, transición y autorización de verificación/descarte. BD: `improvement_actions` y `business_audit_events` conservan actor, estado y valores; cierre sin resultado, por rol incorrecto o cambio posterior se rechaza.
Criterio de aprobación: decisión de Jefatura registrada y restricciones demostradas; valor 85 declarado no certifica mejora causal ni aceptación empresarial de MICOTRANS.
Relación: P05_A6, P05_A7, P05_A8, P05_A9, P05_A10, P05_A11, P05_A12, P05_E3; RF-75, RF-77; RNF-15; H18.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT045 — Vistas BI de solo lectura

Actor: Analista de Jefatura con apoyo del Administrador. Precondiciones: contrato y nombres de vistas actuales localizados en migraciones; cuenta de lectura de pruebas. Datos: filtro D-A/20-10-2026.
Pasos: 1. Conectar cliente BI autorizado a BD de pruebas. 2. Consultar las vistas declaradas, registrar sus nombres reales y población. 3. Comparar con `/reports/bi`. 4. Intentar edición desde cuenta de lectura sobre dato sintético, con apoyo técnico.
Resultado esperado UI: visual BI recupera datos y muestra fuente/periodo. Backend: consultas EcoRoute mantienen mismo contrato. BD: vistas existentes y permisos reales permiten SELECT y deniegan escritura; no asumir permisos por nombre de vista.
Criterio de aprobación: vistas y privilegios inspeccionados, fórmulas reproducibles y cero mutación por usuario lector.
Relación: P05_A3, P05_A4; RF-81; RNF-15, RNF-34; H18, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## P06 — Habilitar recursos de reparto

### UAT046 — Registrar conductor con datos válidos

Actor: Administrador. Precondiciones: cuenta ADMIN y licencia sintética no registrada. Datos: `Persona UAT046`, licencia de prueba ajustada al formato actual, teléfono/correo base.
Pasos: 1. Abrir `/drivers` y nuevo conductor. 2. Completar nombres, licencia, teléfono, correo y actividad. 3. Guardar, buscar y recargar. 4. Verificar vínculo de identidad mediante proceso autorizado.
Resultado esperado UI: datos persistidos una sola vez y vínculo con cuenta distinguible del nombre. Backend: POST `/drivers` valida entrada. BD: fila `drivers` con datos y external_id correcto cuando se vincula; ninguna identidad por defecto.
Criterio de aprobación: registro válido no se presenta como licencia oficialmente verificada por el sistema.
Relación: P06_A2, P06_A6; RF-09; RNF-37; H02, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT047 — Rechazar licencia y contacto inválidos

Actor: Administrador. Precondiciones: formulario de conductor abierto. Datos: licencia vacía, teléfono `texto`, correo `sin-arroba`.
Pasos: 1. Probar cada campo inválido con los demás válidos. 2. Guardar y leer error. 3. Corregir el campo y repetir. 4. Buscar la persona antes de completar variante válida.
Resultado esperado UI: mensajes concretos y datos conservados. Backend: validación igual a la anunciada por formulario; no registra datos inválidos. BD: ningún conductor adicional en negativos ni modificación de otro recurso.
Criterio de aprobación: las tres validaciones se demuestran, sin asumirlas por atributo HTML solamente.
Relación: P06_A2, P06_G1, P06_A3; RF-09; RNF-18, RNF-37; H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT048 — Registrar vehículo y capacidad positiva

Actor: Administrador. Precondiciones: placa sintética no usada. Datos: `UAT-048`, marca/modelo de prueba, capacidad 500 kg; variantes 0 y -1.
Pasos: 1. Abrir `/vehicles`, nuevo vehículo. 2. Intentar capacidad cero/negativa. 3. Guardar datos válidos y recargar. 4. Seleccionarlo en planificación y revisar capacidad.
Resultado esperado UI: unidad kg explícita y negativos rechazados. Backend: valida entrada y persiste capacidad correcta. BD: una fila `vehicles`, sin capacidad negativa, elegible según actividad.
Criterio de aprobación: capacidad mostrada coincide con utilizada al aprobar carga en P02.
Relación: P06_A6, P06_A7; RF-13; RNF-37; H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT049 — Revisión documental y recurso no habilitado

Actor: Jefatura y Administrador. Precondiciones: documento de licencia/mantenimiento sintético vencido. Datos: motivo `UAT049 documento pendiente`.
Pasos: 1. Jefatura revisa documento en canal autorizado. 2. Administrador registra bloqueo/inactividad por control disponible. 3. Dispatcher intenta seleccionar recurso en P02. 4. Repetir intento de aprobación con apoyo técnico local.
Resultado esperado UI: recurso bloqueado no se ofrece como disponible; sustento documental externo identificado. Backend: aprobación rechaza recursos inactivos. BD: actividad refleja decisión; no se afirma existencia de expediente/licencia validada si solo hay isActive.
Criterio de aprobación: bloqueo técnico efectivo más evidencia humana de la causa; no basta ocultarlo en selector.
Relación: P06_A4, P06_A5, P06_E2; RF-11, RF-15, RF-67; RNF-29; H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT050 — Editar recurso conservando identidad

Actor: Administrador. Precondiciones: conductor y vehículo de prueba registrados. Datos: teléfono nuevo `900000002`, capacidad 450 kg.
Pasos: 1. Editar teléfono de D-A y guardar. 2. Editar capacidad V-A y guardar. 3. Recargar ambas pantallas. 4. Consultar rutas/revisiones afectadas sin despachar.
Resultado esperado UI: conserva IDs y muestra valores nuevos; advierte revisión si cambio afecta carga aprobada. Backend: PUT actualiza registro correcto y valida reglas vigentes. BD: mismo conductor/vehículo; consistencia de aprobaciones al variar capacidad debe inspeccionarse y registrar brecha si no se invalida.
Criterio de aprobación: no se pierde vínculo de identidad ni se conserva aprobación incompatible con capacidad actual.
Relación: P06_A6, P06_A7, P06_A9; RF-11, RF-15; RNF-29; H02, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT051 — Disponibilidad futura y reserva diaria

Actor: Dispatcher y Jefatura. Precondiciones: recurso ocupado hoy, disponible mañana; autorización humana para jornada futura. Datos: 20/10 y 21/10/2026.
Pasos: 1. Revisar disponibilidad del recurso hoy. 2. Intentar asignarlo a otra ruta del mismo día. 3. Crear plan del día siguiente según disponibilidad verificada. 4. Registrar reserva futura en canal existente.
Resultado esperado UI: distingue ocupado, inactivo y reservado; no inventa calendario si no existe. Backend: valida conflicto por fecha y actividad. BD: rutas por fecha correctas; reserva documental separada si no hay entidad propia.
Criterio de aprobación: ninguna doble reserva activa diaria y limitación de agenda futura expresada al usuario.
Relación: P06_A7, P06_A8, P06_E3, P06_A9; RF-27, RF-67; RNF-29; H13, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT052 — Buscar, paginar y vacío de recursos

Actor: Administrador. Precondiciones: 12 conductores y 12 vehículos sintéticos. Datos: licencia/placa en segunda página y búsqueda `NO-UAT`.
Pasos: 1. Ir a segunda página de cada listado. 2. Buscar licencia/placa conocida. 3. Buscar texto sin coincidencias. 4. Limpiar búsqueda y abrir edición del resultado.
Resultado esperado UI: contador/página se ajusta al filtro, vacío comprensible y detalle correcto. Backend: registrar si paginación es local o servidor; lectura no cambia actividad. BD: filas intactas.
Criterio de aprobación: ningún resultado oculto por página fuera de rango y no se confunde vacío con error.
Relación: P06_A2, P06_A6; RF-10, RF-14; RNF-19, RNF-20; H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT053 — Eliminar recurso no usado y proteger referenciado

Actor: Administrador. Precondiciones: recurso nuevo sin referencias y otro asignado a ruta. Datos: IDs de fixtures descartables.
Pasos: 1. Cancelar primero el diálogo de eliminación del recurso libre. 2. Confirmar eliminación de ese recurso. 3. Intentar eliminar el referenciado. 4. Reabrir ruta y revisar respuesta.
Resultado esperado UI: cancelar no cambia nada; eliminar libre actualiza lista; referenciado se protege con mensaje de conflicto o baja definida. Backend: regla coherente con FK y dominio, sin 500 opaco. BD: ningún huérfano ni cascada inesperada sobre pedidos/rutas.
Criterio de aprobación: operación acotada y datos referenciados íntegros; prueba solo con fixtures autorizadas.
Relación: P06_A5, P06_A6; RF-12, RF-16; RNF-18, RNF-29; H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT054 — Dispatcher y Conductor no administran recursos

Actor: Dispatcher y Conductor. Precondiciones: sesiones separadas sin ADMIN. Datos: URL `/drivers`, `/vehicles` e IDs de prueba.
Pasos: 1. Abrir enlaces directos de ambos módulos. 2. Revisar navegación/menú. 3. Con apoyo técnico intentar altas/ediciones con ambas sesiones. 4. Administrador verifica registros.
Resultado esperado UI: guard coherente con privilegio; acceso lector operativo, si existe, se diferencia de administración. Backend: niega escrituras no permitidas aunque el usuario altere URL. BD: ningún cambio de recurso.
Criterio de aprobación: seguridad de servidor, sin depender de ocultar botones.
Relación: P06_A6, P08_A6; RF-06; RNF-34, RNF-38; H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## P07 — Supervisar la jornada

### UAT055 — GPS usa vehículo real de la ruta

Actor: Conductor D-A y Dispatcher. Precondiciones: R-A usa V-A cuyo ID no es 1; R-B usa V-B. Datos: tres ubicaciones sintéticas sucesivas.
Pasos: 1. Conductor abre su ruta e inicia seguimiento. 2. Generar posiciones controladas en dispositivo de pruebas. 3. Dispatcher observa R-A y luego R-B. 4. Consultar historial por vehículo.
Resultado esperado UI: marcador y avance pertenecen a V-A; R-B no se desplaza por estos puntos. Backend: POST `/gps/ping` valida pertenencia/vehículo desde operación real. BD: `vehicle_gps_history` registra V-A/D-A, sin vehículo fijo ni mezcla de rutas.
Criterio de aprobación: identidad y vehículo coinciden en toda la cadena de cada punto.
Relación: P07_A1, P07_A7; RF-56, RF-57, RF-59; RNF-29; H02, H07.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT056 — Canal en tiempo real autenticado y suscripción correcta

Actor: Dispatcher. Precondiciones: dos vehículos activos y canal local disponible. Datos: pings alternos V-A/V-B y sesión anónima separada.
Pasos: 1. Abrir R-A en web con sesión válida. 2. Enviar pings de ambos vehículos desde dispositivos de prueba. 3. Registrar mensajes recibidos y marcador actualizado. 4. Intentar canal sin autenticación con apoyo técnico.
Resultado esperado UI: actualiza solo la suscripción pertinente y no expone vehículos ajenos. Backend: handshake/suscripción autenticados según diseño actual, sin filtrar token en logs. BD: persiste pings autorizados y no escribe por conectarse anónimo.
Criterio de aprobación: evidencia del canal real; no afirmar WebSocket porque la UI recibe datos mediante polling.
Relación: P07_A1, P07_A7; RF-58, RF-59; RNF-11, RNF-35; H06.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT057 — Pérdida de señal y reconexión del seguimiento

Actor: Conductor y Dispatcher. Precondiciones: ruta en progreso con último punto conocido. Datos: corte de red de 60 segundos en equipo de prueba.
Pasos: 1. Registrar marcador/hora de último punto. 2. Cortar conexión y observar mapa. 3. Dispatcher contacta al conductor en canal sintético y registra pérdida. 4. Reconectar y enviar nuevo punto.
Resultado esperado UI: distingue dato antiguo de posición actual y recupera seguimiento; si no hay indicador de antigüedad queda defecto. Backend: cierre/reintento no crea múltiples suscripciones o timers activos. BD: no fabrica posiciones durante el corte; nuevos puntos conservan hora y vehículo.
Criterio de aprobación: recuperación visible y ausencia de movimiento ficticio; contacto humano separado de la detección técnica.
Relación: P07_G1, P07_A2, P07_A3, P07_E1; RF-56, RF-58; RNF-11, RNF-18; H06, H07.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT058 — GPS inválido y permiso revocado durante jornada

Actor: Conductor. Precondiciones: seguimiento activo. Datos: permiso revocado, velocidad negativa y coordenadas fuera de rango en fixture técnica.
Pasos: 1. Revocar permiso del dispositivo de pruebas. 2. Observar mensaje/estado y detener seguimiento si corresponde. 3. Probar datos inválidos mediante cliente técnico de pruebas. 4. Restaurar permiso y validar un punto real de prueba.
Resultado esperado UI: no presenta seguimiento activo con posición inventada. Backend: rechaza datos inválidos y no acepta vehicleId ajeno. BD: únicamente puntos válidos y autorizados, sin coordenadas de reemplazo.
Criterio de aprobación: permiso, validez y propiedad son condiciones independientes y se registran los tres resultados.
Relación: P07_A1, P07_A3; RF-56, RF-57; RNF-37; H02, H04, H07.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT059 — Comparar avance y escalar atraso

Actor: Dispatcher y Jefatura. Precondiciones: parada con ventana vencida en fixture y ruta en progreso. Datos: motivo `UAT059 desvío confirmado por conductor`.
Pasos: 1. Revisar posición, paradas pendientes y ventana. 2. Contactar al conductor y confirmar causa sintética. 3. Registrar/escalar la alerta por canal disponible. 4. Abrir incidencia P04 conservando referencia de ruta/parada.
Resultado esperado UI: datos permiten revisar atraso; no confunde ETA estimada con hora real. Backend: consultas no cierran incidencias automáticamente. BD: registro de alerta solo si hay operación real; de lo contrario acta externa vinculada y brecha explícita.
Criterio de aprobación: Jefatura puede seguir la alerta hasta P04 con actor/hora, sin deducir gestión humana del marcador GPS.
Relación: P07_A4, P07_A5, P07_A6, P07_E2, P04_A2; RF-40, RF-59, RF-78; RNF-18; H07, H10, H14.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT060 — Notificación de entrega llega al panel

Actor: Conductor y Dispatcher. Precondiciones: objetos/cola/worker locales de pruebas disponibles; contador no leído conocido. Datos: POD válido de O-A.
Pasos: 1. Registrar entrega. 2. Esperar dentro del plazo operativo acordado y registrar latencia. 3. Abrir panel de notificaciones. 4. Consultar evento/outbox/cola con apoyo técnico.
Resultado esperado UI: una notificación identificable por pedido, sin afirmar que ya fue leída. Backend: evento durable se procesa y produce notificación. BD: `delivery_outbox` y `notifications` enlazan efecto; estado de envío/reintento demostrable.
Criterio de aprobación: un evento de negocio produce una notificación visible y el contador coincide.
Relación: P07_A7, P03_A13; RF-60, RF-61; RNF-13; H11, H12.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT061 — Leer notificación y conservar contador

Actor: Dispatcher. Precondiciones: dos notificaciones no leídas de prueba. Datos: IDs A y B.
Pasos: 1. Abrir panel y leer A. 2. Marcar A de nuevo si el control lo permite. 3. Recargar navegador. 4. Revisar lista y contador sin tocar B.
Resultado esperado UI: contador baja una unidad y permanece estable al reintentar/recargar. Backend: PATCH `/notifications/{id}/read` es coherente con consultas de no leídas. BD: solo A cambia a leída, sin duplicados ni contador negativo.
Criterio de aprobación: estado durable y alcance de lectura correspondiente al usuario/rol previsto.
Relación: P07_A7; RF-61, RF-62; RNF-29; H12, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT062 — Reiniciar infraestructura conserva entrega y reintento

Actor: Administrador de pruebas y Dispatcher. Precondiciones: entorno local con volúmenes identificados, evento pendiente y POD válido. Datos: IDs de evento/objetos/notificación.
Pasos: 1. Registrar estado previo sin borrar datos. 2. Reiniciar únicamente servicios locales autorizados de almacenamiento/cola/worker. 3. Esperar recuperación y abrir evidencia/notificación. 4. Revisar reintento y conteos.
Resultado esperado UI: recupera archivos y muestra entrega/notificación sin repetición. Backend: inicialización idempotente y reintento durable. BD/bucket/cola: conservan datos; outbox avanza solo tras procesamiento confirmado.
Criterio de aprobación: efecto único y recuperación documentados; si faltan volúmenes/entorno se bloquea, sin prueba en producción.
Relación: P07_A7, P03_A12; RF-53, RF-60; RNF-12, RNF-13, RNF-28; H11, H12.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT063 — Jornada final entrega resultados a evaluación

Actor: Dispatcher y Jefatura. Precondiciones: todas las paradas de R-A terminales, incluyendo un fallo. Datos: dos entregas y un fallo.
Pasos: 1. Actualizar seguimiento al cerrar última parada. 2. Abrir resultado de ruta. 3. Jefatura abre P05 con misma fecha/conductor. 4. Comparar totales y razones de fallo.
Resultado esperado UI: ruta final y reporte coherentes, sin presentar jornada como todo entregado. Backend: cierre automático usa todos los estados terminales y reporte mantiene fallos. BD: estado final, totales e historial reconciliados.
Criterio de aprobación: handoff P07→P05 conserva las tres paradas y su resultado individual.
Relación: P07_A7, P07_E3, P05_A1; RF-31, RF-63, RF-69; RNF-29; H09, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## P08 — Administrar accesos

### UAT064 — Solicitud aprobada y rol mínimo

Actor: Jefatura y Administrador. Precondiciones: cuenta sintética nueva en proveedor de identidad, sin rol EcoRoute. Datos: cargo conductor y solicitud `ACCESO-UAT064`.
Pasos: 1. Jefatura registra necesidad/alcance y aprobación en canal real. 2. Administrador abre `/users`, pestaña Roles efectivos Keycloak, identifica subject, asigna DRIVER y vincula D-A activo. 3. Iniciar sesión de nuevo con esa cuenta. 4. Revisar acceso operativo y ausencia de administración.
Resultado esperado UI: cuenta tiene mínimo alcance solicitado, identidad no confundida con nombre visible. Backend: PUT `/users/identities/{id}/roles` actualiza proveedor con actor autenticado y vínculo válido; rol efectivo coherente con JWT/sesión. BD/proveedor: `drivers.external_id` y roles Keycloak coinciden; `auth_user_role` anterior permanece como consulta de migración, no fuente de autorización ni escritura obligatoria.
Criterio de aprobación: la persona solo puede su operación; aprobación empresarial permanece distinta de ejecución técnica.
Relación: P08_A1, P08_A3, P08_A5, P08_A6, P08_A8; RF-06, RF-07; RNF-34; H02, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT065 — Login web válido e inválido

Actor: Dispatcher. Precondiciones: cuenta DISPATCHER habilitada en proveedor local. Datos: usuario válido, contraseña errónea y luego correcta; no registrar su valor.
Pasos: 1. Abrir `/login` y autenticar con dato incorrecto. 2. Observar error y redirección segura. 3. Repetir con credencial válida. 4. Abrir pedidos y rutas; medir token con apoyo técnico.
Resultado esperado UI: error comprensible sin exponer secretos; inicio válido lleva a operación permitida. Backend/proveedor: autentica por identidad legítima y sesión comprobable. BD: no inventa conductor/rol por un fallo de login ni modifica datos operativos.
Criterio de aprobación: identidad efectiva corresponde a cuenta; RNF-03 requiere medición de emisión de token, no tiempo completo del navegador.
Relación: P08_A5, P08_A6; RF-01; RNF-03, RNF-32, RNF-33; H16, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT066 — Login móvil, vínculo y sesión al reiniciar

Actor: Conductor D-A. Precondiciones: cuenta DRIVER vinculada a conductor activo y dispositivo de pruebas. Datos: D-A; otra cuenta DRIVER sin vínculo.
Pasos: 1. Autenticar D-A, abrir rutas y reiniciar app. 2. Comprobar restauración segura. 3. Cerrar sesión y probar cuenta sin vínculo. 4. Inspeccionar almacenamiento con apoyo autorizado sin copiar tokens a evidencia.
Resultado esperado UI: mantiene sesión válida de D-A y explica falta de vínculo de la otra cuenta. Backend: deriva conductor del subject, sin fallback a ID fijo. BD: no crea vínculo ficticio; almacenamiento local protege sesión según configuración real del dispositivo.
Criterio de aprobación: sesión/propiedad se conservan tras reinicio y la cuenta no vinculada no ve rutas ajenas.
Relación: P08_A5, P08_A6, P03_A1; RF-02, RF-04; RNF-36; H02, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT067 — Renovación y vencimiento de sesión

Actor: Dispatcher y Conductor. Precondiciones: entorno de pruebas con vida de token conocida y autorización para ajustar solo la fixture de identidad. Datos: sesión próxima a expirar.
Pasos: 1. Abrir operación y esperar/forzar vencimiento de prueba. 2. Hacer lectura antes y después de renovación. 3. Invalidar refresh de prueba y repetir. 4. Observar tratamiento del formulario no guardado.
Resultado esperado UI: renovación transparente si válida; si falla, solicita login y conserva/advierte borrador sin afirmar guardado. Backend: rechaza token vencido y acepta solo renovado legítimo. BD: no cambia datos por renovar ni replica una escritura pendiente sin confirmación.
Criterio de aprobación: no hay bucle de login/renovación ni uso indefinido de credencial vencida.
Relación: P08_A6; RF-03, RF-04; RNF-35, RNF-41; H16, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT068 — Cerrar sesión y separar datos de dos conductores

Actor: Conductores D-A y D-B en dispositivo de pruebas compartido. Precondiciones: D-A con caché y POD pendiente local de su pedido. Datos: O-A y O-X.
Pasos: 1. Cerrar sesión D-A desde app. 2. Abrir pantalla protegida mediante volver/enlace. 3. Entrar como D-B. 4. Revisar rutas, caché y sincronización. 5. Volver a D-A y revisar su pendiente.
Resultado esperado UI: D-B no ve/sincroniza evidencia de D-A; cierre informa tratamiento de pendientes. Backend/proveedor: sesión cerrada según contrato y tokens invalidados/expirados conforme a política. BD: cero entrega ajena; cola local aislada por usuario o mecanismo seguro equivalente documentado.
Criterio de aprobación: no hay fuga por caché/outbox ni pérdida silenciosa del POD pendiente.
Relación: P08_A4, P08_A6, P03_A12; RF-05, RF-06; RNF-34, RNF-36; H02, H05, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT069 — Menús, enlaces directos y endpoints por rol

Actor: Administrador, Dispatcher y Conductor. Precondiciones: tres sesiones separadas. Datos: `/users`, `/purchases`, `/reports`, `/orders`, `/routes`.
Pasos: 1. Revisar menú y abrir cada URL con cada rol. 2. Intentar lectura y escritura de prueba mediante controles visibles. 3. Apoyar con peticiones directas de pruebas donde UI bloquea. 4. Comparar matriz guard/backend.
Resultado esperado UI: permisos claros sin pantalla vacía engañosa. Backend: autoriza cada operación y propiedad, no solo ruta de navegación. BD: ninguna mutación denegada; reads de Conductor no filtran operación ajena.
Criterio de aprobación: matriz observada coincide con privilegios acordados, incluidos `/reports` ADMIN y aceptación de hoja DRIVER.
Relación: P08_A3, P08_A6, P08_A7; RF-06; RNF-34, RNF-38; H02, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT070 — Cambio de rol, revocación y sesiones abiertas

Actor: Administrador y usuario de prueba. Precondiciones: sesión activa y aprobación de baja sintética. Datos: subject, roles efectivos y cuenta distinta de la del administrador ejecutor.
Pasos: 1. Registrar rol efectivo actual. 2. Deshabilitar identidad o ajustar roles en pestaña Keycloak de `/users`. 3. Usuario intenta operar con sesión abierta y luego tras nuevo login. 4. Revisar proveedor/sesión y registros de auditoría. 5. Con apoyo técnico probar POST/DELETE de roles locales anteriores y comprobar 410 sin habilitación alternativa.
Resultado esperado UI: acceso retirado dentro del plazo de política declarada; comunica expiración/denegación y distingue registro local anterior. Backend: PUT `/users/identities/{id}/enabled` o `/roles` aplica cambio y revocación según contrato; endpoints legacy no conceden acceso. BD/proveedor: baja/cambio y vínculo consistentes; medir vigencia efectiva del token anterior sin asumir revocación instantánea por su contenido.
Criterio de aprobación: alcance/tiempo de revocación demostrado y ninguna escritura legacy suplanta al proveedor; las afirmaciones de UI se contrastan con sesión real de pruebas.
Relación: P08_A4, P08_E2, P08_A7; RF-05, RF-07; RNF-34, RNF-41; H16, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT071 — Acceso rechazado y comunicación al solicitante

Actor: Jefatura y Administrador. Precondiciones: solicitud sintética sin justificación/aprobación. Datos: `ACCESO-UAT071` y motivo `Sin necesidad operativa acreditada`.
Pasos: 1. Revisar necesidad y rechazarla. 2. Comunicar decisión por canal identificado. 3. Consultar usuarios y proveedor. 4. Solicitante intenta iniciar operación permitida solo a usuarios habilitados.
Resultado esperado UI: no aparece acceso habilitado ni rol creado por una solicitud rechazada. Backend: deniega operación sin rol/identidad autorizada. BD/proveedor: ninguna asignación activa nueva; rechazo queda en registro humano si no existe expediente digital.
Criterio de aprobación: evidencia del rechazo y ausencia de habilitación, sin comunicación ficticia atribuida al sistema.
Relación: P08_A1, P08_G1, P08_A2, P08_E1; RF-06, RF-07; RNF-34; H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT072 — Token inválido y frecuencia de peticiones

Actor: Administrador de pruebas con usuario operativo. Precondiciones: entorno local aislado y límite configurado conocido. Datos: token ausente/alterado/expirado; ráfaga controlada de lecturas sobre límite, nunca contra producción.
Pasos: 1. Abrir lectura protegida con las tres variantes inválidas mediante apoyo técnico. 2. Con sesión válida superar límite de pruebas acotado. 3. Revisar mensaje UI/HTTP y plazo de reintento. 4. Esperar ventana configurada y repetir una lectura.
Resultado esperado UI: distingue sesión inválida y exceso de frecuencia sin reintento infinito. Backend: 401/403 según frontera y 429 para límite, recuperación posterior. BD: sin mutación ni log con secretos; no atribuir el límite a IP si la clave efectiva es otra.
Criterio de aprobación: validación criptográfica/límite y recuperación observados; evidencia de código sola no aprueba.
Relación: P08_A6; RF-08; RNF-05, RNF-35; H16, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## P09 — Registrar compras operativas

### UAT073 — Necesidad cubierta sin compra

Actor: Dispatcher y Administrador. Precondiciones: insumo sintético disponible según comprobación humana. Datos: solicitud `COMP-UAT073`, un paquete de material de prueba.
Pasos: 1. Registrar necesidad/prioridad en canal disponible. 2. Comprobar existencia y presupuesto. 3. Entregar recurso existente y documentar cierre. 4. Buscar solicitud/compra en EcoRoute.
Resultado esperado UI: no se crea compra para representar entrega desde stock si no corresponde. Backend: ninguna alta de compra automática por comprobación humana. BD: `purchases` sin fila nueva; registro de stock/decisión solo si existe módulo, o evidencia externa identificada.
Criterio de aprobación: final sin compra trazable sin inventar módulo de inventario.
Relación: P09_A1, P09_A2, P09_G1, P09_A3, P09_E1; RF-71; RNF-29; H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT074 — Evaluación y autorización de gasto

Actor: Administrador y Jefatura. Precondiciones: necesidad no cubierta y propuesta sintética de proveedor. Datos: proveedor `Proveedor UAT074`, importe 120.50, decisión de aprobación externa identificada.
Pasos: 1. Comparar costo/proveedor y dejar sustento. 2. Jefatura autoriza gasto por canal disponible. 3. Registrar referencia del acuerdo en nota de compra cuando exista. 4. Revisar que registro de compra no equivalga automáticamente a autorización.
Resultado esperado UI: aprobación humana distinguible de status de compra; si no hay workflow digital se declara externo. Backend: no suple autorización con un simple POST de datos. BD: solo campos/operaciones reales; nota referencia aprobación sin inventar firma ni entidad.
Criterio de aprobación: se puede recuperar decisión, actor y sustento, dejando explícito el alcance parcial del CRUD.
Relación: P09_A4, P09_A5, P09_G2; RF-71; RNF-29; H16, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT075 — Cancelar solicitud no aprobada

Actor: Jefatura y Administrador. Precondiciones: solicitud no autorizada, sin compra ejecutada. Datos: `COMP-UAT075` y motivo `Fuera de presupuesto de prueba`.
Pasos: 1. Rechazar propuesta y comunicar ajuste. 2. Elegir cancelación definitiva en el registro real disponible. 3. Consultar listado de compras. 4. Comprobar que no se recibió ni pagó bien alguno en fixture.
Resultado esperado UI: cancelación/registro externo identificable sin mostrar compra recibida. Backend: no crea gasto ni estado positivo por el rechazo. BD: no aparece compra ejecutada; si se usa borrador, su estado real/nota coincide con cancelación permitida.
Criterio de aprobación: final cancelado conserva motivo y no utiliza eliminación de una compra real como sustituto de autorización.
Relación: P09_A6, P09_G3, P09_E2; RF-71, RF-73; RNF-29; H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT076 — Registrar compra recibida

Actor: Administrador. Precondiciones: autorización y recepción humana de prueba documentadas. Datos: descripción `Material UAT076`, proveedor ficticio, importe 120.50, categoría prueba y nota con referencia de comprobante sintético.
Pasos: 1. Abrir `/purchases` y nueva compra. 2. Completar campos y estado permitido por contrato. 3. Guardar, buscar y recargar. 4. Revisar si admite adjuntar comprobante; registrar brecha si solo hay nota.
Resultado esperado UI: fila única, importe/estado correctos y comprobante recuperable solo si realmente soportado. Backend: POST `/purchases` valida/persiste. BD: una fila `purchases`; no se presume tabla de facturas/archivos por existir texto en notes.
Criterio de aprobación: datos persistidos y referencia de recepción correctas; adjunto faltante queda limitación, no función aprobada.
Relación: P09_A7, P09_A9, P09_E4; RF-71; RNF-29, RNF-37; H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT077 — Compra inválida y monto no positivo

Actor: Administrador. Precondiciones: formulario nuevo abierto. Datos: descripción vacía, proveedor vacío, importe 0, -1 y texto no numérico.
Pasos: 1. Probar cada variante con los demás campos completos. 2. Guardar y leer error. 3. Corregir todos los campos y guardar una vez. 4. Buscar descripción de prueba.
Resultado esperado UI: validación concreta, sin NaN ni éxito aparente. Backend: rechaza entrada inválida según restricciones de PurchaseRequest vigentes; documentar discrepancias de obligatoriedad. BD: ninguna fila parcial/inválida ni compra duplicada al corregir.
Criterio de aprobación: regla UI/servidor alineada con el contrato documentado y monto persistido exacto.
Relación: P09_A9; RF-71; RNF-18, RNF-37; H17, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT078 — Editar compra y conservar referencia

Actor: Administrador. Precondiciones: compra sintética editable; autorización para corrección documentada. Datos: importe corregido 125.75 y nota `Corrección UAT078`.
Pasos: 1. Buscar compra y abrir editar. 2. Modificar importe/nota y guardar. 3. Recargar y revisar referencia de comprobante. 4. Consultar datos persistidos e historial si existe.
Resultado esperado UI: mismo ID con importe nuevo y referencia conservada. Backend: PUT `/purchases/{id}` valida y actualiza solo compra elegida. BD: misma fila y precisión monetaria correcta; no afirmar historial inmutable si no existe implementación.
Criterio de aprobación: cambio limitado al registro objetivo y limitación de auditoría expresada cuando corresponda.
Relación: P09_A9; RF-73; RNF-29, RNF-37; H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT079 — Buscar, paginar y exportación no presumida

Actor: Administrador. Precondiciones: 12 compras sintéticas, una en segunda página. Datos: proveedor/descripcion única y búsqueda sin coincidencias.
Pasos: 1. Ir a segunda página, buscar compra y abrir edición. 2. Buscar texto inexistente y limpiar. 3. Revisar si hay exportación específica de compras. 4. Si existe, ejecutarla y comparar con filtro; si no, registrar que RF-70 corresponde a reportes y no prueba exportación de compras.
Resultado esperado UI: paginación/filtro coherentes y vacío claro. Backend: lecturas reales según implementación; ningún endpoint de exportación supuesto. BD: sin cambios por consultar/exportar.
Criterio de aprobación: listado cumple búsqueda/paginación y cada capacidad adicional se identifica por evidencia real.
Relación: P09_A9; RF-72; RNF-19, RNF-20; H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT080 — Cancelar y confirmar eliminación de compra de prueba

Actor: Administrador. Precondiciones: compra sintética descartable sin referencias contables reales. Datos: ID y descripción única.
Pasos: 1. Pulsar eliminar y cancelar diálogo. 2. Recargar y comprobar permanencia. 3. Repetir y confirmar. 4. Consultar listado y fila por ID.
Resultado esperado UI: cancelar no cambia datos; confirmar retira solo el registro seleccionado y comunica resultado. Backend: DELETE `/purchases/{id}` respeta permisos/contrato. BD: baja/eliminación según implementación sin afectar otras compras ni recursos.
Criterio de aprobación: operación ejecutada únicamente sobre fixture identificada y resultado persistido coincide con UI.
Relación: P09_A9; RF-74; RNF-29; H16, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT081 — Bien observado, reclamo y entrega a habilitación

Actor: Administrador, Dispatcher y Jefatura. Precondiciones: dos recepciones sintéticas, una conforme y otra defectuosa. Datos: `COMP-UAT081-A/B`, motivo `Bien de prueba incompleto`.
Pasos: 1. Revisar recepción física de prueba. 2. Para defecto, reclamar/devolver en canal disponible y registrar sustento. 3. Para conforme, registrar compra y transferir información a P06. 4. Verificar que no se habilita automáticamente un vehículo/conductor por crear compra.
Resultado esperado UI: distingue observación comercial externa y compra registrada; handoff explícito a responsable. Backend: no crea recurso operativo sin su alta/validación correspondiente. BD: filas de compras coherentes y `drivers`/`vehicles` intactos hasta P06.
Criterio de aprobación: ambos finales/handoff quedan documentados, sin inventar módulo de reclamos/recepción ni aprobar recurso automáticamente.
Relación: P09_G4, P09_A8, P09_E3, P09_A9, P09_E4, P06_A2; RF-71, RF-73; RNF-29; H15, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## Soporte transversal y recuperación

### UAT082 — Perfil del conductor y licencia

Actor: Conductor D-A. Precondiciones: cuenta vinculada y perfil sintético disponible. Datos: D-A con licencia propia.
Pasos: 1. Abrir `/profile` en móvil. 2. Comparar nombre/licencia/contacto con registro de prueba. 3. Cerrar sesión y entrar como D-B. 4. Reabrir perfil.
Resultado esperado UI: datos del conductor autenticado, sin valores de demostración ni residuos del usuario anterior. Backend: lectura autorizada por identidad actual. BD: sin cambios de conductor ni consulta expuesta de identidad ajena.
Criterio de aprobación: perfil pertenece a cada cuenta y no depende de ID fijo/cache compartida.
Relación: P08_A6, P06_A6; RF-46; RNF-34; H02, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT083 — Tema, idioma y estados legibles

Actor: Conductor y Dispatcher. Precondiciones: móvil/web con pedidos en varios estados. Datos: tema claro/oscuro y texto de error controlado.
Pasos: 1. Alternar tema móvil y abrir rutas, detalle, historial y sincronización. 2. Reiniciar app y observar preferencia según contrato. 3. Revisar estados por color y etiqueta. 4. Provocar una validación y comprobar idioma.
Resultado esperado UI: controles legibles, español y estados identificables por texto además de color; tema aplicado coherentemente. Backend: no cambia operación por tema. BD: pedidos/rutas intactos; preferencia local persistida solo si el producto lo anuncia.
Criterio de aprobación: completar consulta y captura en ambos temas sin controles ilegibles ni textos técnicos expuestos.
Relación: P03_A1, P03_A8, P08_A6; RF-47; RNF-17, RNF-21, RNF-22, RNF-23; H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT084 — Tamaño de foto y contenido inválido

Actor: Conductor con apoyo técnico de pruebas. Precondiciones: pedido editable, límites de JSON/upload identificados. Datos: imagen válida hasta 10 MB, 10 MB+1 byte y archivo no imagen.
Pasos: 1. Intentar captura/carga válida al límite. 2. Probar exceso y contenido inválido. 3. Observar mensaje y cola local. 4. Recuperar con foto válida pequeña y sincronizar.
Resultado esperado UI: informa tamaño/formato y conserva borrador; no reintenta indefinidamente un rechazo permanente. Backend: acepta límite anunciado o registra discrepancia entre binario/base64/JSON, rechaza exceso/contenido inválido. BD/S3: no quedan POD exitosos ni objetos huérfanos aceptados en negativos.
Criterio de aprobación: límites efectivos medidos en bytes y recuperación sin pérdida; no se aprueba por configuración nominal.
Relación: P03_A8, P03_A9, P03_A12; RF-48, RF-49, RF-53; RNF-04, RNF-12; H05, H19, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT085 — Error de lectura, vacío y reintento

Actor: Dispatcher y Conductor. Precondiciones: lectura con datos conocidos y proxy/servicio de pruebas controlable. Datos: respuesta vacía legítima; 503; timeout.
Pasos: 1. Abrir listado vacío legítimo y capturar UI. 2. Preparar indisponibilidad de API de pruebas y recargar listado con datos. 3. Leer error e intentar reintento. 4. Restaurar servicio y comprobar recuperación.
Resultado esperado UI: distingue vacío, cargando y fallo; no presenta cache antigua como dato nuevo sin aviso. Backend: timeout acotado y respuesta/error trazable. BD: no cambia datos por reintentar lectura ni desaparecen filas en servidor.
Criterio de aprobación: recuperación visible y ninguna pérdida silenciosa por convertir error en lista vacía.
Relación: P01_A2, P02_A1, P03_A1, P05_A1; RF-21, RF-28, RF-38; RNF-07, RNF-18; H05, H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT086 — Navegación profunda y reinicio en detalle móvil

Actor: Conductor. Precondiciones: pedido propio y ruta cargados, sesión válida. Datos: enlace `/orders/{id}` y luego ID inexistente.
Pasos: 1. Abrir detalle desde lista. 2. Cerrar proceso y reabrir por enlace profundo del dispositivo de pruebas. 3. Repetir sin objeto extra de navegación. 4. Probar ID inexistente y volver a rutas.
Resultado esperado UI: recupera pedido por ID o muestra error recuperable; no falla por cast obligatorio de `state.extra` ni permite pedido ajeno. Backend: carga autorizada si la UI consulta, 404/denegación según caso. BD: sin mutaciones por navegación.
Criterio de aprobación: ningún crash ni objeto obsoleto al reiniciar; dependencia no resuelta del extra queda defecto.
Relación: P03_A1, P03_A8, P08_A6; RF-22, RF-42; RNF-18; H02, H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT087 — Conflicto offline cuando servidor ya cerró pedido

Actor: Conductor y Dispatcher. Precondiciones: POD pendiente local O-A; cierre autorizado de O-A en servidor por otra operación de prueba. Datos: dos evidencias distintas y dos claves de operación.
Pasos: 1. Capturar POD offline sin enviarlo. 2. En fixture controlada cerrar O-A desde otra sesión permitida. 3. Reconectar y sincronizar primer POD. 4. Abrir conflicto en pantalla de sincronización y revisar acciones seguras.
Resultado esperado UI: conflicto visible, no descarta foto/firma silenciosamente ni lo muestra como enviado. Backend: diferencia reintento idéntico de operación nueva incompatible. BD: conserva cierre/evidencia vigente sin sobrescribirla; cola local mantiene conflicto hasta decisión documentada.
Criterio de aprobación: resolución explícita sin doble entrega ni pérdida de sustento; no se inventa botón de resolver si aún no existe.
Relación: P03_A12, P03_A13, P04_A2; RF-44, RF-54; RNF-24, RNF-29; H03, H05, H19.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT088 — Dos sesiones sobre asignación/aprobación/despacho

Actor: dos Dispatchers de prueba, Jefatura y Conductor. Precondiciones: ruta PLANNED aprobada/aceptada y pedido reasignable. Datos: R-A/R-B y timestamps previos.
Pasos: 1. Preparar reasignación en sesión A y despacho en sesión B. 2. Confirmar casi simultáneamente con apoyo técnico local. 3. Revisar respuesta de ambas sesiones. 4. Recargar ruta, revisión, aceptación y pedido.
Resultado esperado UI: una operación pierde por conflicto si las condiciones dejan de cumplirse; no muestra dos éxitos incoherentes. Backend: bloqueo/transacción preserva invariantes y valida revisión vigente. BD: ruta y pedido no quedan en rutas/estados incompatibles ni con aprobación obsoleta vigente.
Criterio de aprobación: resultados conciliados por ID/tiempo con ninguna carrera que habilite carga no revisada.
Relación: P02_A5, P02_A10, P02_A12, P02_A14; RF-19, RF-27, RF-29, RF-30; RNF-29, RNF-31; H01, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT089 — Salud y documentación API sin exponer secretos

Actor: Administrador de pruebas y responsable técnico. Precondiciones: entorno local identificado; contrato OpenAPI y rutas reales de health documentadas. Datos: URLs locales obtenidas de configuración, sin asumir permisos públicos.
Pasos: 1. Abrir página de documentación/estado autorizada. 2. Buscar operaciones de confirmación, revisión, POD y BI actuales. 3. Comparar campos y errores con formularios. 4. Revisar logs sanitizados de fallo controlado.
Resultado esperado UI: contrato legible y estado de servicio comprensible para soporte. Backend: especificación actual incluye nuevos endpoints y restricciones; salud no expone secretos. BD: sin mutaciones por consultar documentación; preparación no ejecuta migraciones destructivas.
Criterio de aprobación: contratos coinciden con código ejecutado en pruebas, identidad y versión registradas; existencia de JSON estático no basta.
Relación: P08_A6, P02_A10, P03_A8, P05_A3; RF-06; RNF-10, RNF-26, RNF-40, RNF-47; H17, H20.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT090 — Rendimiento percibido y tiempos medidos

Actor: Dispatcher, Conductor y responsable técnico. Precondiciones: carga/volumen de prueba definidos y motor local estable; reloj/medidor conocido. Datos: 20 lecturas operativas, 20 cálculos de ruta y 20 emisiones de token por fixture técnica acotada.
Pasos: 1. Completar búsqueda, apertura de ruta y login. 2. Registrar percepción de espera sin convertirla en medición de servidor. 3. Adjuntar mediciones de latencia de cada operación bajo carga definida. 4. Comparar umbrales y explicar percentil usado.
Resultado esperado UI: carga/error visibles sin congelar formulario. Backend: consultas <50 ms, cálculo <200 ms y emisión <500 ms se evalúan en frontera/técnica definida por RNF; registrar incumplimientos. BD: índices/plan de consulta se revisan sin modificar datos desde este caso.
Criterio de aprobación: informe de medición reproducible más recorrido usable; no declarar cumplimiento a partir de un solo click o compilación.
Relación: P01_A2, P02_A7, P08_A6; RF-21, RF-33, RF-01; RNF-01, RNF-02, RNF-03, RNF-08; H17.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT091 — Sesión expira mientras outbox intenta enviar

Actor: Conductor. Precondiciones: dos POD pendientes del mismo usuario y sesión a expirar en entorno de pruebas. Datos: claves estables A/B y foto/firma de prueba.
Pasos: 1. Iniciar sincronización y provocar vencimiento controlado. 2. Revisar comportamiento ante 401/refresh fallido. 3. Reiniciar app y volver a autenticar la misma cuenta. 4. Reanudar sincronización y consultar entregas.
Resultado esperado UI: conserva pendientes, solicita login y no crea un bucle de reintentos. Backend: rechaza credencial vencida y reintenta con credencial legítima sin repetir efectos confirmados. BD: cada pedido tiene una sola entrega; archivos locales solo se liberan tras confirmación durable y para el usuario correcto.
Criterio de aprobación: ninguna operación se pierde ni se envía como otro usuario tras relogin.
Relación: P03_A12, P08_A6; RF-03, RF-04, RF-54; RNF-35, RNF-36, RNF-41; H05, H16.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT092 — Cambiar condiciones comerciales invalida plan

Actor: Dispatcher, Jefatura y Conductor. Precondiciones: pedido PENDING/ASSIGNED en ruta PLANNED con aprobación y aceptación vigentes. Datos: nueva nota comercial y luego pedido ya IN_TRANSIT en fixture separada.
Pasos: 1. Abrir datos comerciales y cambiar nota/check de cobertura. 2. Guardar y consultar revisión de ruta. 3. Intentar despachar sin repetir aprobación/aceptación. 4. Intentar modificar condiciones de un pedido ya despachado.
Resultado esperado UI: muestra revisión pendiente tras cambio y bloqueo de edición incompatible. Backend: BusinessWorkflowService.confirm invalida revisión y restringe estados editables; despacho revalida. BD: confirmación/auditoría ligadas al actor y ambas decisiones previas invalidadas; intento sobre IN_TRANSIT no cambia acuerdo.
Criterio de aprobación: condiciones vigentes y plan despachado nunca divergen silenciosamente.
Relación: P01_A6, P01_A8b, P02_A10, P02_A12, P02_A14; RF-17, RF-19, RF-29; RNF-29, RNF-31; H01, H10, H15.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT093 — Entrevista de aceptación con cinco tareas

Actor: usuarios humanos MICOTRANS de Dispatcher, Conductor, Administrador y Jefatura, con facilitador. Precondiciones: entorno seguro, versión registrada, casos anteriores seleccionados y acta en blanco. Datos: fixture de pedido/ruta/POD/incidencia/reporte de este plan.
Pasos: 1. Cada persona realiza las cinco tareas de satisfacción de `Acta_UAT_Plantilla.md` que correspondan a su rol. 2. Registrar ayuda, errores, tiempo y respuesta literal voluntaria. 3. Revisar defectos críticos y decisiones de aceptación por proceso. 4. Completar acta solo con participantes reales.
Resultado esperado UI: usuario puede explicar y completar tareas observadas. Backend/BD: los cinco efectos se contrastan con evidencia técnica de los casos vinculados, sin ejecutar cambios fuera de la fixture. Un agente no puede atribuir satisfacción ni firma a MICOTRANS.
Criterio de aprobación: la persona responsable emite decisión documentada; mientras no se realice entrevista humana, aceptación empresarial sigue pendiente aunque un agente haya recorrido toda la UI.
Relación: P01_A9, P02_A14, P03_A8, P04_A1, P05_A4, P06_A6, P07_A7, P08_A6, P09_A9; RF-17, RF-29, RF-54, RF-75, RF-78; RNF-17, RNF-18; H01, H05, H10, H18, H19.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT094 — Eliminar pedido de prueba y proteger su trazabilidad

Actor: Dispatcher autorizado. Precondiciones: un pedido PENDING descartable sin dependencias y otro con POD/historial; datos exclusivamente sintéticos. Datos: ambos IDs y conteos previos.
Pasos: 1. En `/orders`, solicitar eliminar el pedido descartable y cancelar. 2. Repetir y confirmar. 3. Intentar eliminar pedido final con evidencia. 4. Revisar referencias y recuperabilidad del POD; no ejecutar sobre datos reales.
Resultado esperado UI: cancelar conserva registro; eliminación permitida informa resultado; registro con evidencia se protege o se trata según política explícita. Backend: DELETE `/orders/{id}` valida privilegios/integridad y devuelve conflicto comprensible si corresponde. BD: no deja POD, auditoría o intento huérfano ni pierde historia mediante cascada silenciosa.
Criterio de aprobación: eliminación de fixture acotada sin degradar evidencia; carencia de política de conservación o error 500 de FK queda defecto.
Relación: P01_A9, P03_A11; RF-24; RNF-29, RNF-39; H15, H19.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT095 — Eliminar ruta vacía y proteger ruta operativa

Actor: Dispatcher autorizado. Precondiciones: ruta PLANNED vacía descartable y otra IN_PROGRESS con pedidos/puntos GPS. Datos: ambos IDs y fechas.
Pasos: 1. Buscar acción de eliminación real para ruta vacía; cancelar primero y luego confirmar. 2. Repetir intento sobre ruta operativa. 3. Consultar pedidos, revisiones, GPS y ruta tras ambas operaciones. 4. Si no existe control UI, registrar bloqueado aunque el endpoint exista.
Resultado esperado UI: resultado claro y ruta operativa protegida conforme a política explícita. Backend: DELETE `/routes/{id}` valida rol/estado/referencias, sin ocultar conflicto como éxito. BD: elimina solo fixture permitida; no deja pedidos/revisiones/GPS huérfanos ni reasigna silenciosamente.
Criterio de aprobación: integridad y conservación histórica demostradas; endpoint aislado no aprueba experiencia de usuario.
Relación: P02_A4, P02_A14, P07_A7; RF-32; RNF-29; H15, H19.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

### UAT096 — CLOSE_CASE sin alterar pedido ni crear reintento

Actor: Jefatura mediante ADMIN autorizado y Dispatcher para negativa de permisos. Precondiciones: incidencia general de ruta sin pedido y, en fixture separada, disputa de un pedido DELIVERED con POD íntegro. Datos: razón `UAT096 caso revisado sin modificar entrega`.
Pasos: 1. Abrir cada incidencia en `/incidents` y seleccionar CLOSE_CASE desde cuenta ADMIN. 2. Guardar y recargar. 3. Intentar resolver de nuevo con misma decisión y luego con otra distinta. 4. Probar cierre definitivo con Dispatcher. 5. Consultar pedido, POD, incidente y `order_attempts`.
Resultado esperado UI: caso resuelto sin presentar pedido como fallido ni prometer nuevo intento; decisión disponible solo al rol autorizado. Backend: `BusinessOperationsService.resolve` admite CLOSE_CASE general o sobre entregado, exige ADMIN y conserva resultado original. BD: V13 permite resolución válida con razón/actor/fecha; sin nuevo `order_attempts` ni mutación de pedido/POD; conservar `LEGACY_UNATTRIBUTED` como origen histórico, sin atribuirlo a usuario actual.
Criterio de aprobación: cierre de caso distinguible de CLOSE_FAILED/RETRY/REPLAN, efecto único y autorización de servidor demostrados.
Relación: P04_A2, P04_A5, P04_A8, P03_A11; RF-23, RF-44, RF-78; RNF-24, RNF-29, RNF-34; H03, H10, H15, H19.
Estado: no ejecutado; agente: sin ejecución registrada; validación humana MICOTRANS: pendiente.

## Registro de ejecución que debe completarse posteriormente

Por cada ID copiar: versión/commit o hashes de fuentes; entorno y fecha America/Lima; ejecutor real y tipo agente/persona; alias/IDs de fixture; pasos realizados/desviaciones; resultado UI; HTTP/payload sanitizado; consultas y resultado de BD/almacenamiento; enlaces de captura/log; aprobado/fallido/bloqueado/no ejecutado técnico; defecto/Hxx; repetición y resolución. En campo separado: responsable humano MICOTRANS, observaciones y decisión empresarial pendiente/aceptado/con reservas/rechazado. No convertir automáticamente un test Java, un escaneo de archivos o un caso UAT escrito en un caso de usuario ejecutado.

Evidencia técnica incorporada por referencia: `evidencias/regresion_api.json` declara 49/49 PASS en Docker local con datos sintéticos, ejecutada el 20/10/2026 05:21:53Z (20/10, 00:21:53 Lima). Es regresión API, no ejecución de estos 96 casos de usuario; su `humanAcceptance` permanece PENDING. El inventario conserva IDs C01–C49 como `API:Cxx` y su asociación por proceso, con verificación pendiente del alcance por nodo y de la revisión exacta probada.
