# Acta de validación UAT — plantilla sin completar

Empresa: MICOTRANS. Producto evaluado: EcoRoute. Estado: pendiente de validación humana. Esta plantilla no acredita una sesión realizada, aceptación, satisfacción, consentimiento ni firma. Ningún campo de participante o firma se ha completado con identidad ficticia.

## Identificación de la sesión

Fecha/hora y zona: ____________________

Lugar/modalidad: ____________________

Entorno de pruebas, URLs y versión/hashes evaluados: ____________________

Alcance/limitaciones de la sesión y datos sintéticos utilizados: ____________________

Facilitador real: ____________________

Responsable humano MICOTRANS de la decisión: ____________________

| Participante real (completar en sesión) | Cargo de negocio | Rol técnico/cuenta de prueba | Tareas observadas | Presencia confirmada |
|---|---|---|---|---|
| ____________________ | ____________________ | ____________________ | ____________________ | Pendiente |
| ____________________ | ____________________ | ____________________ | ____________________ | Pendiente |
| ____________________ | ____________________ | ____________________ | ____________________ | Pendiente |
| ____________________ | ____________________ | ____________________ | ____________________ | Pendiente |

Cargo y rol técnico se registran por separado. Si Jefatura usa una cuenta ADMIN para la aprobación, documentar aquí la autorización acordada. El nombre EcoRoute corresponde a la herramienta, nunca a un participante humano.

## Separación de ejecución técnica y aceptación empresarial

| Tipo de evidencia | Ejecutor | Fecha/versión | IDs/capturas/logs | Resultado | Valor de aceptación |
|---|---|---|---|---|---|
| Recorrido UI ejecutado por agente, si se realiza posteriormente | Sin registrar | Sin registrar | Sin registrar | No ejecutado en este trabajo | No sustituye validación MICOTRANS |
| Prueba técnica automatizada, si se adjunta evidencia revisada | Sin registrar | Sin registrar | Sin registrar | No acreditada por esta plantilla | No equivale a satisfacción del usuario |
| Recorrido observado de usuario humano MICOTRANS | Sin registrar | Sin registrar | Sin registrar | Pendiente | Requiere decisión explícita de la persona responsable |

No copiar un resultado de compilación o inventario de fuentes como una UAT ejecutada. Si se incorporan resultados de otros agentes, verificar archivo original, fecha, versión, entorno, pruebas omitidas y alcance antes de completar la fila. Toda aprobación empresarial permanece pendiente hasta la sesión humana y su decisión documentada.

## Registro por caso

Repetir este bloque por cada ID seleccionado de `Plan_Pruebas_Usuario.md`:

ID UAT / proceso / nodos BPMN / RF-RNF / Hxx: ____________________

Actor humano observado o agente ejecutor identificado: ____________________

Precondiciones e IDs de fixture comprobados: ____________________

Pasos realizados y ayudas del facilitador: ____________________

Resultado UI observado, incluyendo errores/pendientes: ____________________

Petición/respuesta backend sanitizada y correlación: ____________________

Resultado de lectura de BD/objetos/cola y consulta acotada usada: ____________________

Evidencias y versión: ____________________

Resultado técnico (seleccionar posteriormente): no ejecutado / bloqueado / fallido / aprobado: ____________________

Defecto, gravedad, Hxx y responsable de corrección: ____________________

Repetición, fecha y resultado: ____________________

Decisión humana MICOTRANS para este caso: pendiente / aceptado / con reservas / rechazado: ____________________

Observación literal voluntaria del participante: ____________________

## Cinco tareas y preguntas de satisfacción

Aplicar solo a las personas cuyo trabajo incluya la tarea; marcar no aplica y motivo en las demás. Las cinco tareas no equivalen a cinco personas ni se completan con respuestas del agente. Usar escala 1 = muy difícil / nada claro; 2 = difícil; 3 = intermedio; 4 = fácil / claro; 5 = muy fácil / muy claro. Registrar respuestas reales sin promedios o resultados precargados. No se presenta esta encuesta como instrumento psicométrico validado ni se inventa un puntaje SUS.

| Tarea de usuario | Casos sugeridos | Preguntas después de la tarea | Valor 1–5 / no aplica | Respuesta literal, ayuda y tiempo observado |
|---|---|---|---|---|
| 1. Registrar y confirmar un pedido, distinguiendo RUC, condiciones y las tres verificaciones | UAT001, UAT004–UAT006 | ¿Pudo distinguir qué datos faltaban y por qué todavía no podía asignarlo? ¿Qué palabra o control cambiaría? | Pendiente | Pendiente |
| 2. Preparar ruta, aprobar carga y aceptar hoja antes de despachar | UAT010–UAT018 | ¿Pudo identificar quién debe aprobar y quién debe aceptar? ¿Comprendió por qué un cambio de pedidos invalida la revisión anterior? | Pendiente | Pendiente |
| 3. Capturar POD y recuperar un envío offline tras reiniciar/reconectar | UAT020–UAT027, UAT087, UAT091 | ¿Pudo distinguir guardado local, envío rechazado y entrega confirmada en servidor? ¿Confía en recuperar la evidencia y qué información le falta? | Pendiente | Pendiente |
| 4. Registrar una incidencia y seguir su decisión sin perder el motivo | UAT028–UAT036, UAT059 | ¿Pudo explicar qué quedó registrado y qué decisión corresponde a una persona? ¿Encontró el motivo, responsable y estado de seguimiento? | Pendiente | Pendiente |
| 5. Filtrar resultados, exportar e interpretar indicadores y metas | UAT037–UAT045 | ¿Pudo explicar el periodo, conductor, numerador y denominador de los indicadores? ¿Diferenció sin datos, sin meta y debajo de meta al revisar/exportar? | Pendiente | Pendiente |

Pregunta global posterior: ¿qué tarea no podría realizar todavía en su jornada real y qué cambio la haría viable? Respuesta: ____________________

Pregunta de adecuación: ¿qué decisión o documento sigue fuera de EcoRoute y quién se hace responsable de registrarlo? Respuesta: ____________________

Pregunta de confianza: ¿qué evidencia necesitaría revisar antes de considerar cerrada una entrega o una jornada? Respuesta: ____________________

Método de resumen acordado y cantidad de respuestas válidas: pendiente. No tratar no aplica como cero; informar cantidad por tarea y no extrapolar a toda MICOTRANS una muestra no representativa.

## Decisión por proceso y pendientes

| Proceso | Casos revisados / defectos | Decisión humana | Condiciones, responsable y fecha compromiso |
|---|---|---|---|
| P01 Confirmar pedidos | Pendiente | Pendiente | Pendiente |
| P02 Preparar jornada | Pendiente | Pendiente | Pendiente |
| P03 Ejecutar entregas | Pendiente | Pendiente | Pendiente |
| P04 Resolver incidencias | Pendiente | Pendiente | Pendiente |
| P05 Evaluar resultados | Pendiente | Pendiente | Pendiente |
| P06 Habilitar recursos | Pendiente | Pendiente | Pendiente |
| P07 Supervisar jornada | Pendiente | Pendiente | Pendiente |
| P08 Administrar accesos | Pendiente | Pendiente | Pendiente |
| P09 Registrar compras | Pendiente | Pendiente | Pendiente |

Decisión global de la persona responsable: pendiente. Reservas o restricciones de uso: ____________________

Próxima revisión y evidencia requerida: ____________________

## Constancia a completar únicamente con personas reales

Nombre/cargo de quien emite la decisión: ____________________

Fecha y medio de conformidad real (firma, acta empresarial o referencia verificable): ____________________

Nombre/cargo de quien recibe observaciones: ____________________

Fecha y constancia real de recepción: ____________________

Los espacios en blanco no representan firmas ni aprobaciones. Si no participa un responsable real de MICOTRANS, conservar el estado pendiente.
