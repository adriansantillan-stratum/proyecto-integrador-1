# EcoRoute - Driver App (Flutter)

Este proyecto corresponde a la aplicación móvil para conductores del sistema **EcoRoute**, construida con Flutter bajo principios de Clean Architecture y SOLID.

## 🏗 Arquitectura

El proyecto sigue **Clean Architecture** estructurado en las siguientes capas por cada "Feature" (ej. `auth`, `orders`, `gps`):

1.  **Domain:** Entidades (`entities`), Contratos (`repositories`), Casos de Uso (`usecases`). La separación tiene una excepción actual: el contrato de pedidos importa `SubmissionResult` desde `core/sync/proof_sync.dart`, módulo que también depende de Flutter y Dio. No se afirma aislamiento puro de todas las dependencias.
2.  **Data:** Modelos (`models`), Repositorios concretos (`repositories`), Fuentes de datos (`datasources` - local y remote).
3.  **Presentation:** Estados y lógica (`bloc` o `cubit`), Interfaz de usuario (`pages`, `widgets`).
4.  **Core:** Utilidades, inyección de dependencias (`get_it`), temas (`theme`), manejo de errores (`error`).

## 📦 Stack Tecnológico

-   **State Management:** `flutter_bloc`
-   **Dependency Injection:** `get_it`
-   **Networking:** `dio`
-   **Programación Funcional (Manejo de Errores):** `dartz` (Either, Left, Right)
-   **Almacenamiento privado:** `flutter_secure_storage` para sesión, cachés por cuenta y cola de POD completa. Isar no forma parte de las dependencias actuales.
-   **Routing:** `go_router`

## 🚀 Cómo Empezar

1.  Asegúrate de tener Flutter SDK instalado (`flutter doctor`).
2.  Posiciónate en esta carpeta `mobile-app/`.
3.  Usa Flutter >= 3.35 (verificado con Flutter 3.41.4 / Dart 3.11.1); las carpetas nativas ya están versionadas.
4.  Ejecuta `flutter pub get` si aún no tienes las dependencias.
5.  Configura las direcciones mediante `--dart-define=API_BASE_URL=...` y `--dart-define=KEYCLOAK_BASE_URL=...`. Los valores predeterminados son `http://10.0.2.2:8081` y `http://10.0.2.2:8080` para emulador Android. También se admiten `KEYCLOAK_REALM` y `KEYCLOAK_CLIENT_ID`. En dispositivo físico utiliza una dirección accesible del servidor y HTTPS según el entorno.

La sesión requiere `GET /session/me` con conductor vinculado al subject; no hay asociaciones de demostración en el cliente. Se renueva por el claim `exp` del JWT o tras un 401, compartiendo una única renovación entre solicitudes concurrentes.

La hoja `PLANNED` debe estar aprobada y aceptada por el conductor antes del despacho. La app muestra revisión/aceptación; la operación de pedidos se habilita para rutas `IN_PROGRESS`. La entrega requiere foto, firma confirmada, receptor, DNI y GPS actual. Los fallos/devoluciones requieren motivo.

Un POD se guarda completo antes del envío, incluyendo los bytes de foto/firma; la UI lo muestra pendiente hasta que el servidor confirma. La cola sobrevive a reconstruir los servicios y se aísla por cuenta. Hay reintento cada 30 s mientras el proceso corre, al volver a primer plano y al restaurar sesión. No se garantiza ejecución con la app terminada o suspendida por el sistema. Los 4xx definitivos conservan la evidencia con motivo visible y reintento manual.

Verificación host, sin dispositivo:

```powershell
flutter analyze --no-pub
flutter test --no-pub
# Opt-in contra backend local; utiliza la cuenta DRIVER documentada del repositorio:
./tools/audit_e2e/run_backend_contract.ps1
```

El informe de pruebas y pendientes está en [mobile_fix_notes.md](tools/audit_e2e/mobile_fix_notes.md). Las pruebas de contrato no aceptan ni modifican rutas operativas. La exportación PNG nativa de firma, cámara, persistencia real, suspensión y permisos requieren validación en dispositivo; los tests de unidad usan fakes. No instalar APK ni usar ADB durante la coordinación de esta auditoría sin avisar al agente principal.
