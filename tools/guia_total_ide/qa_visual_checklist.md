# QA posterior de la guía total

Preparación solamente. No generar DOCX, ejecutar marker, renderizar ni abrir UI hasta el aviso de main.

## Antes de generar

- Revisar el manifest definitivo: 19 pantallas, todos los estados realmente capturados y evidencias adicionales de IDE. Los casos previstos no se convierten en PASS por lectura de código.
- W02 Inicio: main validará desplazamiento DOM real y capturas superior/inferior tras la corrección de Home. Registrar el check de navegación completa con `scrollHeight > clientHeight`, cambio de `scrollTop` y acceso visible/accionable a Vehículos y Compras con ADMIN. Las capturas deben compartir W02 y distinguir estados superior e inferior. La toma inferior descartada no cuenta como evidencia; no marcar PASS antes de recibir la validación. Este cambio no modifica Auth y no requiere un test CSS.
- Incluir `ide/flutter_debugger.jpg` con sus bytes JPEG originales y el check de control Dart: main confirmó F6, `Paused on pause`, Call Stack y reanudación con Continue/F5. La imagen fue declarada limpia de datos privados por main; la revisión visual posterior debe comprobarlo también en el documento.
- Mantener la referencia HTTP del servicio y las claves exclusivamente en `.runtime`. No copiar direcciones autenticadas, material de firma ni contenido de configuración privada al Word.
- Ejecutar la validación del builder con el Python bundled. Deben existir las fuentes y las capturas; actualmente hay 39 fragmentos para 19 pantallas, máximo tres por pantalla.
- Main ejecuta el marker de creación exactamente una vez inmediatamente antes del primer authoring. Este checklist no ejecuta ni sustituye ese paso.

## Render y revisión de todas las páginas

Usar el `render_docx.py` de la skill documents con Python y LibreOffice bundled. Guardar los PNG de QA en `docs/guia_total_ide/_qa`; no usar Word COM ni el LibreOffice del escritorio. No entregar PNG/PDF intermedios como resultado final.

- Abrir cada página renderizada a 100 %. Comprobar Letter vertical, cuerpo de 11 pt, títulos negros, ausencia de bordes bajo títulos, texto cortado, solapamientos y páginas vacías.
- Revisar tablas: cabeceras junto a la primera fila cuando caben, anchos legibles, padding y filas sin altura fija que recorte texto.
- Comprobar los 19 bloques y todas las capturas del manifest, incluidos estados de modales, vistas inferiores e IDE. Conservar íntegros los bytes y la proporción de cada imagen; no recortar ni reconstruir interfaces.
- Límites de figura: ancho 7 pulgadas, alto web 4,4 y móvil 5,6. Si el texto queda pequeño, comprobar el enlace a la imagen original completa. Cada figura debe conservar paso, estado, pie y ruta local.
- Confirmar líneas, sangría, ajuste de texto y contratos de los fragmentos. Revisar especialmente la explicación nueva de retención de identidad en W01.
- En W04 y W12, contrastar el caso de la ruta 22: propuesta actual del mapa 3,19 km desde origen GPS y pendientes, frente al plan persistido al despacho y mostrado en reportes de 8,53 km. Ninguno es distancia GPS validada. El hueco GPS mayor de 900 s conserva `No evaluable`, no 0; los 90 minutos incluyen la pausa de exposición y no acreditan tiempo de entrega real.
- Comprobar `debuggerType: dart`, uso de `Prepare-FlutterDebugger.ps1` y restricción de hot reload desde el original cuando la app procede de Temp. La URI privada no debe aparecer en texto ni capturas.
- Vigilar el presupuesto aproximado de 70 páginas. Reducir repetición o ajustar agrupación antes que disminuir el cuerpo, omitir pantallas o retirar evidencias.
- Si cambia contenido o maquetación tras renderizar, repetir render y revisión de todas las páginas afectadas; la revisión final debe cubrir todas las páginas de la versión entregada.

## Comprobación funcional aún separada del QA de Word

El auth fix tiene nueve tests unitarios de la política de identidad, TypeScript y lint aprobados. Estos tests no montan React Router ni demuestran por sí solos la persistencia visual de un modal o filtros durante un refresh real. Si main realiza esa comprobación, registrar su resultado independiente: mismo subject conserva vista durante carga; cambio de usuario, error o revocación retiran la identidad. El HMR del cambio requiere capturas nuevas cuando la vista esté estable.

## Cierre

Main corrige cualquier defecto observado, verifica correspondencia entre manifest, figuras y checks y entrega únicamente el DOCX y el Markdown solicitados.
