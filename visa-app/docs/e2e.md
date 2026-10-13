# Pruebas E2E con Playwright (SCRUM-219)

Suite en `visa-app/e2e/` que recorre en un navegador real (Chromium) el flujo completo de un cliente nuevo,
contra el backend real y una base PostgreSQL real:

1. Registro con una cuenta nueva y selección de perfil de visa.
2. Dashboard con el aviso de correo sin verificar.
3. DS-160 bloqueado sin asesor asignado.
4. DS-160 completo, las 10 secciones, guardado en el backend.
5. Subida de los tres documentos obligatorios y aprobación por el personal.
6. Pago por transferencia con comprobante, confirmado por el asesor.
7. Cita consular registrada por el asesor y visible para el cliente.
8. Simulador de entrevista con micrófono simulado: graba las respuestas y las envía a retroalimentación.

El cliente solo usa la interfaz. Los pasos que la app reserva al personal (asignar asesor, aprobar documentos,
confirmar pagos, registrar la cita) se hacen por la API real con un administrador y un asesor que el E2E crea en
su propia base.

## Cómo correrlo

Requisitos: Node 20+ y Docker (solo para la base de datos).

```bash
cd visa-app/e2e
npm install
npx playwright install chromium   # una sola vez (~200 MB)
npm run db:up                     # PostgreSQL 15 aislado en el puerto 5434, con init.sql
npm test                          # levanta backend y frontend solos y corre los 8 pasos
npm run report                    # abre el reporte HTML (trazas y capturas de los fallos)
npm run db:down                   # apaga y borra la base del E2E
```

- La base del E2E (`docker-compose.e2e.yml`) usa otro puerto (5434), otro nombre de proyecto (`visa-e2e`) y no tiene
  volumen: **no toca la base de desarrollo** de `docker-compose.yml`. Para apuntar a otro Postgres, usa las variables
  `E2E_DB_HOST`, `E2E_DB_PORT`, `E2E_DB_USER`, `E2E_DB_PASSWORD` y `E2E_DB_NAME`.
- El backend corre con `NODE_ENV=test`, correo vacío (nunca envía correos reales) y archivos en `e2e/.tmp/`.
- El frontend se prueba **compilado** (`vite build` + `vite preview`), como en producción, y no con el servidor de
  desarrollo: con `vite dev` la página se recarga sola al descubrir dependencias y los pasos fallaban de forma
  intermitente.
- Cada ejecución crea un cliente con correo único, así que se puede repetir sin limpiar la base.
- Los pasos van en serie porque cada uno depende del anterior; si uno falla, los siguientes se omiten.

## Hallazgos del E2E

Bugs reales que salieron al recorrer el flujo completo. El primero está corregido en esta misma PR; los demás
quedan documentados para resolverlos aparte.

1. **Corregido: el simulador de entrevista no cargaba preguntas y cerraba la sesión.** El backend exige sesión en
   `GET /questions/random`, pero `InterviewSimulator.jsx` lo pedía sin el token. La respuesta 401 hacía que
   `apiClient` borrara la sesión, así que al abrir el simulador el usuario quedaba fuera. Ahora se envía
   `buildSessionHeaders()`, con una prueba de regresión en `InterviewSimulator.test.jsx`.
2. **Pendiente: `useRequireAuth` borra la sesión ante cualquier fallo de red.** Si la validación de sesión
   (`/validar-sesion`) se interrumpe, por ejemplo porque el usuario navega con `window.location.href` mientras sigue
   en vuelo, el navegador aborta la petición y el hook la interpreta como sesión inválida: borra `visaguide_session`
   y manda a `/login`. Debería cerrar la sesión solo ante un 401 real. En el E2E se evita esperando a que la página
   termine de validar antes de navegar (helper `login`).
3. **Pendiente: aviso de perfil que nunca se crea.** `perfilController.js` llama a `notificacionService.crear`, que no
   existe (el método es `crearNotificacion`). Es el mismo error que ya se corrigió en el DS-160 (SCRUM-185); se ve en
   el log del backend al elegir el perfil.
