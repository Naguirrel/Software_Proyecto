# agents.md

Guia de trabajo para devs y agentes de IA que colaboren en VisaGuide.

## Contexto del producto

VisaGuide es una aplicacion web para acompanar procesos de visa estadounidense. El flujo principal cubre registro/login (con verificacion de correo y recuperacion de contrasena), seleccion de perfil de visa, dashboard del tramite, formulario DS-160 (con exportacion a PDF), cronologia, gestion de documentos, preparacion de entrevista, banco de preguntas, retroalimentacion, notificaciones, chat con el asesor, pagos por transferencia y citas consulares.

Hay tres roles (`usuario.rol`): `cliente` (solicitante), `asesor` (panel `/advisor`, solo ve tramites asignados) y `admin` (panel `/admin`).

El proyecto esta organizado como una app full-stack JavaScript:

- Frontend: React 19 + Vite 8 + React Router 7, en `frontend/`.
- Backend: Node.js + Express 5 + PostgreSQL, en `backend/`.
- Base de datos local/contenedores: PostgreSQL 15 con `init.sql` mas migraciones ligeras al arrancar.
- Archivos/documentos/audio: abstraccion `storage.js`, Cloudflare R2 en produccion y fallback local en desarrollo/test.
- Correo: `nodemailer` con proveedor SMTP (Mailtrap en desarrollo) o Resend en produccion (`backend/config/email.js`).
- Pruebas: Vitest/Testing Library para frontend, Jest/Supertest para backend, k6 para carga (`tests/load-test.js`).
- CI: GitHub Actions (`.github/workflows/ci.yml`) en push/PR a `main`.
- Despliegue: EC2 Ubuntu + Docker Compose + Nginx del host (`nginx/visa-app.duckdns.org.conf`), dominio `visa-app.duckdns.org`.
- Documentacion academica, operativa y entregables: `docs/`.

## Estructura importante

```text
visa-app/
  backend/
    app.js                         # Express app, pool de Postgres, migraciones ligeras, seed de desarrollo y montaje de rutas
    index.js                       # Arranque del servidor
    auth.js                        # Tokens de sesion HMAC y middlewares requireSession / requireRole
    r2.js                          # Cliente Cloudflare R2/S3 y helpers de upload/delete
    storage.js                     # Abstraccion de storage: R2 o fallback local
    upload.js                      # Multer memoryStorage + validacion de extension/MIME
    swagger.js, docs/openapi.js    # Swagger UI en /api-docs y contrato en /api-docs.json
    config/cors.js                 # Origenes permitidos por ambiente
    config/email.js                # Transporte de correo (smtp | resend)
    middleware/errorHandler.js     # 404 y manejador central de errores
    templates/emailTemplates.js    # Plantillas de correo
    routes/                        # Rutas modulares por dominio (todas las rutas viven aqui)
    controllers/                   # Controladores HTTP
    services/                      # Logica de dominio y SQL
    test-utils/                    # Harnesses de integracion (auth, documentos, DS-160) y fakeStorage
    __tests__/                     # Pruebas Jest/Supertest
  frontend/
    src/
      App.jsx                      # Router principal, login, registro, recuperacion y verificacion
      routes/lazyRoutes.js         # Carga diferida de paginas
      assets/                      # Imagenes estaticas de la app
      config/api.js                # buildApiUrl y resolucion de VITE_API_URL
      components/                  # UI compartida (cliente)
      components/admin/            # AdminLayout, RequireAdmin, AdminShared, AdminCharts, filtros
      components/advisor/          # AdvisorLayout, RequireAdvisor, AdvisorShared
      components/auth/             # Layout y CSS de autenticacion
      components/ds160/            # Campos e iconos del formulario DS-160
      data/ds160Sections.js        # Definicion de secciones del DS-160
      hooks/                       # useRequireAuth, useTheme, useModoSenior, useDS160Form, useAdminResource
      pages/                       # Pantallas cliente
      pages/admin/                 # Pantallas del panel administrador
      pages/advisor/               # Pantallas del panel asesor
      styles/                      # CSS por area
      utils/                       # apiClient, sessionAuth, advisorApi, documentPreview, validaciones
      __tests__/                   # Pruebas Vitest/Testing Library
    nginx.conf                     # Nginx del contenedor: SPA + proxy /api, /documentos, /local-files
    vite.config.js                 # Vite + Vitest
  docs/                            # Entregables, guiones, estrategia de pruebas, backups, monitoreo
  tools/                           # Scripts Python de entregables + tools/backups y tools/monitoring (bash)
  tests/load-test.js               # Prueba de carga k6
  nginx/                           # Nginx del host EC2 (reverse proxy publico)
  init.sql                         # Esquema y seed inicial para Postgres
  docker-compose.yml               # backend + frontend + db
  docker-compose.override.yml      # Overrides locales (se carga automaticamente con docker compose up)
  .env.example                     # Variables esperadas
```

`coverage/` esta ignorado por git; no lo commitee. Evite modificar `docs/entregables/` salvo que el usuario pida regenerar entregables.

## Historial de sprints

Las secciones siguientes son bitacora historica de ramas ya integradas. Pueden mencionar ubicaciones o contratos que despues cambiaron (por ejemplo, endpoints que vivian en `app.js` o el antiguo `PUT /tramite`); la referencia vigente son las secciones "Backend", "Frontend" y "Riesgos conocidos" de este archivo. Resumen de lo integrado en `main` despues de las secciones de Sprint 6 (orden aproximado, ver `git log` para el detalle):

- Backend y seguridad: refactor de `app.js` a `routes/controllers/services`, bcrypt para contrasenas (SCRUM-150), tokens de sesion y roles, CORS restringido, manejo centralizado de errores (SCRUM-161), datos sensibles movidos al body, pruebas de seguridad (SCRUM-164) y de endpoints/tokens.
- Cuentas: recuperacion de contrasena (SCRUM-168) y verificacion de email no bloqueante (SCRUM-187).
- Administracion: exportacion de reportes CSV/XLSX, busqueda avanzada, historial de cambios de tramite, logs de actividad y recordatorios por email.
- Producto: pagos por transferencia y citas consulares, panel de asesor (`/advisor`), chat cliente-asesor, exportacion del DS-160 a PDF y refactor del DS-160 en frontend.
- Calidad y operacion: pruebas de integracion (SCRUM-182, 183, 184, 185), pruebas E2E y de carga, lazy loading, Swagger, pipeline de CI, backups de PostgreSQL y monitoreo del servidor (SCRUM-199).
- Rama `email-funcional` (aun no integrada en `main`): envio real de correos con Resend (`EMAIL_PROVIDER=resend`).

## Sprint 6 - Administracion de Documentos

Estado actual antes de SCRUM-127:

- SCRUM-125 (`DocumentsListAdmin`) dejo implementada la pantalla `/admin/documents` para administradores, reutilizando `AdminLayout`, Sidebar y Header del panel admin.
- SCRUM-125 agrego listado administrativo con `GET /admin/documents`, protegido por `requireAdmin`, para listar documentos de todos los usuarios con datos del solicitante.
- SCRUM-126 (`DocumentsReviewAdmin`) agrego acciones en la tabla: `Ver documento`, `Aprobar` y `Rechazar`.
- SCRUM-126 agrego `PUT /admin/documents/:id/status`, protegido por `requireAdmin`, para actualizar estados a `approved` o `correction`.
- El cliente usa `GET /documentos/:usuarioId` para ver sus documentos. Los estados `rejected` legados se presentan como `correction` para que el cliente muestre "Requiere Correccion".
- El backend ya tiene `GET /documentos/:id/archivo` para servir archivos desde `storage_key` o redirigir a `archivo_url` externo.
- Los documentos se almacenan en la tabla `documentos` con `archivo_url`, `storage_key`, `estado`, `feedback`, `creado_en` y `actualizado_en`.
- En desarrollo/test, `storage.js` usa fallback local y sirve archivos mediante `/local-files`; en produccion usa R2 cuando esta configurado.

Al implementar SCRUM-127 en `DocumentsCommentsAdmin`:

- No crear pantalla nueva; extender solo `frontend/src/pages/admin/AdminDocuments.jsx`.
- Reutilizar `GET /documentos/:id/archivo` para visualizar documentos; no crear rutas duplicadas para archivos.
- Reutilizar la columna `feedback` existente para observaciones del administrador.
- Reutilizar `PUT /admin/documents/:id/status` para persistir observaciones administrativas; acepta `feedback` sin cambiar estado.
- Presentar observaciones desde una accion dedicada en la tabla, idealmente con modal o panel, evitando textareas permanentes por fila.
- Mantener los cambios en la rama `DocumentsCommentsAdmin`; no hacer merge, rebase ni push.

Estado posterior a SCRUM-127 (`DocumentsCommentsAdmin`):

- Rama de trabajo: `DocumentsCommentsAdmin`.
- Ruta frontend afectada: `/admin/documents`.
- Pantalla afectada: `frontend/src/pages/admin/AdminDocuments.jsx`, dentro de `AdminLayout`.
- Componentes reutilizados: `AdminLayout`, Sidebar/Header administrativo, tabla y estilos de `frontend/src/styles/admin.css`, botones con iconos `lucide-react`.
- Visualizacion de documentos: el boton `Ver documento` abre una URL absoluta construida con `buildApiUrl` cuando `archivo_url` es relativo, evitando que React Router intente resolver `/documentos/:id/archivo` como ruta frontend.
- Endpoint de archivo reutilizado: `GET /documentos/:id/archivo`. Sirve PDFs e imagenes con `Content-Disposition: inline`; otros tipos quedan como descarga mediante `attachment`.
- Observaciones administrativas: se guardan en `documentos.feedback`; la tabla muestra un indicador `Tiene observaciones` o `Sin observaciones` y la edicion se hace desde la accion `Observaciones`.
- Interfaz de comentarios: modal administrativo con textarea, contador de caracteres, botones `Guardar` y `Cancelar`; al abrirlo carga el comentario existente para editarlo.
- Endpoint reutilizado para revision: `PUT /admin/documents/:id/status`, protegido por `requireAdmin`. Acepta `estado`, `feedback` o ambos; `rejected` se normaliza a `correction` para mantener compatibilidad con el cliente.
- Flujo administrador: listar documentos, abrir archivo, aprobar, rechazar, abrir observaciones, editar comentario, guardar sin recargar la pagina y refrescar la fila con la respuesta del backend.
- Arquitectura de revision: los cambios de estado (`Aprobar`/`Rechazar`) se mantienen separados del guardado de observaciones; el modal envia solo `feedback` al endpoint existente.
- Estados UI implementados: loading de listado, error, empty state, mensajes de exito/error, bloqueo de acciones mientras se actualiza estado o se guardan observaciones.

## Sprint 6 - Ajustes visuales del Panel Administrador

Estado posterior a `cambios-generales-admin`:

- Rama de trabajo: `cambios-generales-admin`.
- Pantalla afectada: `/admin/interviews`, usando `frontend/src/components/InterviewReviewPanel.jsx`.
- Layout afectado: `frontend/src/components/admin/AdminLayout.jsx` y estilos de `frontend/src/styles/admin.css`.
- La pantalla de entrevistas ya no depende visualmente de la pagina Banco de Preguntas cuando se renderiza dentro de `AdminLayout`; `admin.css` define el hero, tarjetas resumen, lista de sesiones, detalle, respuestas grabadas y formulario de retroalimentacion.
- El Sidebar administrativo tiene mas separacion entre logo, marca y subtitulo `Administrador`, ademas de un tratamiento visual con gradientes y acentos de color.
- Mantener cualquier ajuste futuro de apariencia admin dentro de `frontend/src/styles/admin.css` salvo que un modulo tenga un stylesheet propio ya establecido.

## Sprint 6 - Audios de Entrevistas para Administradores

Estado posterior a `audios-entrevistas-admin`:

- Rama de trabajo: `audios-entrevistas-admin`.
- El simulador sigue enviando audios como `FormData` a `POST /interview-sessions`.
- `backend/services/interviewSessionService.js` usa `uploadStoredFile` de `backend/storage.js` para guardar audios, con fallback local en desarrollo/Docker y R2 cuando este configurado.
- Los metadatos del audio quedan en `interview_sessions.responses[].audio` con `key`, `provider`, `mimetype`, `size` y una `url` presentada como endpoint backend.
- Endpoint de audio: `GET /interview-sessions/:id/audio/:questionId`.
- `frontend/src/components/InterviewReviewPanel.jsx` convierte rutas relativas de audio con `buildApiUrl`, por lo que el reproductor del admin apunta al backend y no a React Router.
- `frontend/src/pages/InterviewFeedback.jsx` tambien convierte rutas relativas de audio con `buildApiUrl`, para que el cliente pueda volver a escuchar sus grabaciones desde el backend.
- El endpoint de audio debe seguir siendo cargable directamente por `<audio src="...">`; no depender de headers `Authorization`, porque el elemento HTML no los envia.
- No guardar audio en base64 dentro de Postgres; mantener archivos en storage y metadatos en JSONB.

## Sprint 6 - Mejoras del Panel Administrador

Estado inicial antes de las ramas `DocumentsStatusFix`, `AdminSidebarCollapse` y `AdminSidebarScroll`:

- Rama principal del Sprint para estas mejoras: `Dashboard-admin`.
- El Panel Administrador usa `frontend/src/components/admin/AdminLayout.jsx` como layout compartido con Sidebar, Header, notificaciones, cambio de tema y logout.
- Las rutas administrativas estan registradas en `frontend/src/App.jsx` y protegidas con `RequireAdmin`.
- `/admin/documents` usa `frontend/src/pages/admin/AdminDocuments.jsx` y el endpoint `PUT /admin/documents/:id/status`.
- Se verifico una inconsistencia real en documentos: el frontend envia `{ status: "approved" }`, mientras `backend/controllers/adminDocumentController.js` solo normaliza `req.body.estado`.
- Las observaciones administrativas ya se guardan mediante `{ feedback }` y deben seguir funcionando sin cambiar estado.
- El Sidebar admin tiene comportamiento movil con `sidebarOpen`, boton hamburger, backdrop y cierre con Escape.
- El Sidebar admin no tiene colapso de escritorio persistente; el boton del header se oculta en desktop desde `frontend/src/styles/admin.css`.
- El Sidebar admin solo aplica `overflow-y: auto` en mobile; en escritorio la lista de navegacion puede quedar fuera de pantallas bajas.

Tareas planificadas:

- `DocumentsStatusFix`: hacer que el backend acepte tanto `status` como `estado` en `PUT /admin/documents/:id/status`, manteniendo compatibilidad con comentarios y estados `approved`, `correction` y `rejected`.
- `AdminSidebarCollapse`: agregar colapso/expansion de escritorio en `AdminLayout`, persistirlo con `localStorage`, conservar mobile y mostrar tooltips cuando el Sidebar este colapsado.
- `AdminSidebarScroll`: mejorar el scroll vertical de escritorio para que el header y footer del Sidebar queden fijos y solo se desplace la lista de navegacion.
- No hacer merge, rebase ni push desde estas ramas.

Estado final posterior a las mejoras:

- Rama `DocumentsStatusFix`: corrige el contrato de documentos en `backend/controllers/adminDocumentController.js`. El endpoint `PUT /admin/documents/:id/status` acepta `estado` y `status`; `estado` conserva precedencia si ambos llegan. Los comentarios via `feedback` siguen funcionando sin cambiar estado. Se agrego prueba backend en `backend/__tests__/app.test.js`.
- Rama `AdminSidebarCollapse`: agrega Sidebar colapsable de escritorio en `frontend/src/components/admin/AdminLayout.jsx` y `frontend/src/styles/admin.css`. El estado se persiste en `localStorage` con la llave `vg-admin-sidebar-collapsed`, se mantiene al recargar, conserva el comportamiento movil y muestra tooltips con `data-tooltip` cuando esta colapsado. Se agrego prueba en `frontend/src/__tests__/AdminPanel.test.jsx`.
- Rama `AdminSidebarScroll`: mejora el scroll vertical del Sidebar en `frontend/src/styles/admin.css`. En escritorio, el Sidebar usa alto fijo de viewport, header/logo y footer no se desplazan, y solo `.admin-sidebar__nav` tiene `overflow-y: auto`. En mobile se mantiene el scroll del panel completo.
- Componentes reutilizados: `AdminLayout`, `VisaGuideLogo`, `RequireAdmin`, `AdminShared`, rutas existentes y estilos de `admin.css`.
- Cambios de arquitectura: no se agregaron pantallas, rutas ni servicios nuevos; los cambios se limitaron a compatibilidad de payload backend y comportamiento visual del Sidebar.
- Validaciones ejecutadas por rama: backend `npm test`, frontend `npm run test:run -- src/__tests__/AdminPanel.test.jsx`, frontend `npm run test:run` y frontend `npm run build`. Las pruebas y builds pasaron; Vitest mantiene el aviso conocido de jsdom `Not implemented: navigation to another Document` por `window.open`.
- Las ramas quedaron separadas, sin merge, sin rebase y sin push.

## Sprint 6 - Branding y organizacion del Sidebar Administrador

Estado inicial antes de las tareas de Norman en `AdminSidebarIntegrated`:

- Rama de trabajo: `AdminSidebarIntegrated`.
- La rama ya contiene el Sidebar colapsable de escritorio y el scroll vertical de la lista administrativa.
- El Sidebar cliente usa `VisaGuideLogo`, tokens globales `--vg-*`, fondo oscuro `--vg-navy`, acento `--vg-red`, logo con mark rojo y texto blanco.
- El Sidebar administrador todavia mantiene overrides propios en `frontend/src/styles/admin.css`, incluyendo colores hex hardcodeados para logo, fondo, links activos, hover, header y superficies.
- `frontend/src/components/admin/AdminLayout.jsx` mantiene una lista plana de enlaces administrativos, mas acciones de tema, perfil y logout en el footer.
- Se debe alinear el branding del Panel Administrador al sistema visual oficial sin copiar codigo del Sidebar cliente ni cambiar logica de negocio.

Tareas planificadas:

- Branding admin: revisar `VisaGuideLogo`, `VisaGuideLogo.css`, `index.css`, `admin.css` y `AdminLayout.jsx`; reemplazar overrides innecesarios por tokens `--vg-*`; conservar componentes y rutas existentes.
- Organizacion del Sidebar: agrupar enlaces en secciones visuales `Dashboard`, `Gestion`, `Revision`, `Analisis` y `Sistema`; mantener colapso, persistencia, scroll, responsive, iconos, tooltips, opcion activa, teclado y focus visible.
- Commits esperados: `style(admin): align branding with design system` y `refactor(admin): improve sidebar organization`.
- No hacer merge, rebase ni push.

Estado posterior a las tareas de Norman:

- Rama de trabajo: `AdminSidebarIntegrated`.
- Commits realizados: `style(admin): align branding with design system` y `refactor(admin): improve sidebar organization`.
- Branding admin alineado con el sistema visual oficial usando `VisaGuideLogo` y tokens `--vg-*` en `frontend/src/styles/admin.css`: `--vg-bg`, `--vg-text`, `--vg-card`, `--vg-border`, `--vg-navy`, `--vg-navy-mid`, `--vg-red`, `--vg-on-strong`, `--vg-strong-muted`, `--vg-text-muted`, `--vg-danger-text` y `--vg-slate`.
- Sidebar administrativo reorganizado en grupos visuales: `Dashboard`, `Gestion`, `Revision`, `Analisis` y `Sistema`, sin submenus ni rutas nuevas.
- `frontend/src/components/admin/AdminLayout.jsx` mantiene `AdminLayout`, `RequireAdmin`, `VisaGuideLogo`, `useTheme`, `useAdminSession`, `useAdminResource`, `NavLink` y los iconos de `lucide-react`.
- Se conserva el Sidebar colapsable de escritorio con persistencia en `localStorage` mediante la llave `vg-admin-sidebar-collapsed`.
- En estado colapsado se muestran solo iconos, la opcion activa permanece visible y los tooltips se muestran con `data-tooltip` al pasar mouse o enfocar con teclado.
- El scroll vertical de escritorio queda limitado a `.admin-sidebar__nav`; el header de marca permanece fijo arriba y el footer de sistema permanece visible abajo.
- Se conserva el comportamiento movil: drawer lateral, backdrop, cierre por click y sin boton de colapso de escritorio.
- Accesibilidad pulida con `aria-label`, `aria-controls`, `aria-expanded`, `aria-pressed`, foco visible en links/botones y navegacion por teclado.
- Prueba agregada en `frontend/src/__tests__/AdminPanel.test.jsx` para validar los grupos visibles y enlaces principales del Sidebar.
- Validacion enfocada ejecutada: `npm run test:run -- src/__tests__/AdminPanel.test.jsx` en `frontend/`, con 23 pruebas exitosas. El aviso conocido de jsdom sobre navegacion externa no bloquea la suite.
- Sin cambios de arquitectura, sin merge, sin rebase y sin push.

## SCRUM-141 - Notificaciones Automaticas

Estado inicial antes de implementar `AutomaticNotifications`:

- Rama de trabajo esperada: `AutomaticNotifications`.
- La app ya tiene infraestructura de notificaciones: tabla `notificaciones`, `backend/services/notificacionService.js`, `backend/routes/notificacionRoutes.js`, `backend/controllers/notificacionController.js`, `NotificationCenter`, pagina `/notificaciones` y contador del Sidebar cliente.
- Ya existe una notificacion automatica para cambios de etapa mediante `notificarCambioEtapa` en `backend/app.js`, usada por `PUT /tramite` y por flujos legacy de avance.
- La historia SCRUM-141 debe reutilizar el servicio existente `crearNotificacion` y, para cambios de etapa, reutilizar `existeNotificacionEtapa` o helpers existentes para evitar duplicados.
- Alcance: generar notificaciones automaticas por revision de documentos, feedback/calificacion de entrevistas y cambios administrativos de tramite, incluyendo cambio de estado, cambio de etapa y asignacion de asesor.
- No crear endpoints nuevos salvo que sea estrictamente necesario; los eventos deben colgarse de los endpoints existentes de documentos, entrevistas y tramites administrativos.
- Mantener commits separados por fase: documentos, entrevistas y tramites.

Estado final posterior a SCRUM-141 (`AutomaticNotifications`):

- Rama de trabajo: `AutomaticNotifications`.
- Servicios reutilizados: `backend/services/notificacionService.js` con `crearNotificacion`, `existeNotificacionEtapa` y el helper compartido `notificarCambioEtapa`.
- Endpoints reutilizados: `PUT /admin/documents/:id/status`, `PUT /interview-sessions/:id/feedback`, `PUT /admin/processes/:id`, `POST /admin/assignments` y el flujo legacy `PUT /tramite`.
- Componentes reutilizados: `frontend/src/components/NotificationCenter.jsx`, `frontend/src/pages/Notificaciones.jsx` y el contador de notificaciones del Sidebar cliente. No se agregaron pantallas ni endpoints frontend.
- Documentos: al aprobar, rechazar/enviar a correccion o guardar observaciones administrativas se crea una notificacion de tipo `documento` para el usuario propietario del documento. El endpoint admin conserva compatibilidad con `estado` y `status`.
- Entrevistas: al guardar retroalimentacion o calificacion desde el panel admin se crea una notificacion de tipo `entrevista` para el usuario de la sesion.
- Tramites: al cambiar estado se crea una notificacion informativa; al cambiar etapa se reutiliza `notificarCambioEtapa` para evitar duplicados recientes por `etapa_relacionada`; al asignar asesor desde gestion de tramite o desde asignaciones se crea una notificacion informativa.
- No se creo infraestructura nueva de notificaciones ni tablas nuevas; la historia queda integrada sobre la tabla `notificaciones` existente.
- Commits realizados: `feat(notifications): add document review notifications`, `feat(notifications): add interview feedback notifications` y `feat(notifications): add process update notifications`.

## SCRUM-140 - Detalle de Solicitud Administrativa

Estado inicial antes de implementar `AdminRequestDetail`:

- Rama de trabajo esperada: `AdminRequestDetail`.
- La pantalla `/admin/processes` existe en `frontend/src/pages/admin/AdminProcesses.jsx` y ya permite listar, filtrar, paginar y gestionar tramites mediante `GET /admin/processes` y `PUT /admin/processes/:id`.
- No existe ruta frontend `/admin/processes/:id` ni endpoint backend `GET /admin/processes/:id` para consolidar una solicitud individual.
- Componentes reutilizables identificados: `AdminLayout`, `RequireAdmin`, `AdminPageHeader`, `AdminResourceState`, `AdminSearch`, `AdminTabs`, tabla y tarjetas de `frontend/src/styles/admin.css`, `AdminDocuments` para contrato visual/logica de documentos, `AdminDS160` para estado DS-160 e `InterviewReviewPanel` para contrato visual de entrevistas.
- Endpoints reutilizables existentes: `GET /interview-sessions/user/:userId`, `GET /documentos/:usuarioId`, `GET /notificaciones/:userId`, `GET /documentos/:id/archivo`, `PUT /admin/processes/:id`, `PUT /interview-sessions/:id/feedback` y `PUT /admin/documents/:id/status`.
- Para evitar multiples llamadas innecesarias desde el frontend, se evaluara crear `GET /admin/processes/:id` en `backend/routes/adminProcessRoutes.js` con JOINs y consultas agregadas de usuario, tramite, DS-160, documentos, entrevistas y notificaciones.
- La vista debe integrarse al Panel Administrador con el mismo Sidebar/Header, estados de carga/error/empty y acciones de navegacion hacia gestion de tramite, documentos, entrevistas y DS-160 sin duplicar pantallas.
- No hacer merge, rebase ni push desde esta rama.

Estado final posterior a SCRUM-140 (`AdminRequestDetail`):

- Rama de trabajo: `AdminRequestDetail`.
- Nueva ruta frontend: `/admin/processes/:id`, registrada en `frontend/src/App.jsx` y protegida con `RequireAdmin`.
- Nueva pantalla: `frontend/src/pages/admin/AdminProcessDetail.jsx`, renderizada dentro de `AdminLayout` y usando `AdminPageHeader`, `AdminResourceState`, tarjetas, tablas, estados visuales y estilos de `frontend/src/styles/admin.css`.
- Navegacion: `frontend/src/pages/admin/AdminProcesses.jsx` mantiene la accion `Gestionar` y agrega el enlace `Ver detalle` para abrir `/admin/processes/:id`.
- Endpoint creado: `GET /admin/processes/:id` en `backend/routes/adminProcessRoutes.js`, protegido por `requireAdmin`; consolida tramite, solicitante, resumen DS-160, documentos, entrevistas y notificaciones del usuario.
- Endpoints reutilizados desde la vista: `GET /documentos/:id/archivo` para abrir archivos mediante `frontend/src/utils/documentPreview.js`; enlaces a `/admin/processes`, `/admin/documents`, `/admin/interviews` y `/admin/ds160` para gestionar modulos existentes sin duplicar pantallas.
- Componentes/logica reutilizados: `AdminLayout`, Sidebar/Header administrativo, `AdminPageHeader`, `AdminResourceState`, patrones de tabla/card de `admin.css`, contrato de documentos de `AdminDocuments`, resumen DS-160 existente y estructura de entrevistas compatible con `InterviewReviewPanel`.
- Utilidad compartida creada: `frontend/src/utils/documentPreview.js`, usada por `AdminProcessDetail` y `AdminDocuments` para construir URLs absolutas de documentos con `buildApiUrl` y abrirlos sin que React Router capture rutas backend.
- Backend presenta datos normalizados: `tramite`, `solicitante`, `ds160`, `documentos`, `entrevistas` y `notificaciones`; los audios de entrevistas conservan rutas `/interview-sessions/:id/audio/:questionId`.
- Estados UI implementados: loading, error con reintento, empty states por modulo, resumen superior, progreso del tramite, resumen DS-160, documentos, entrevistas, notificaciones y accesos rapidos.
- Pruebas agregadas/actualizadas: `backend/__tests__/adminProcesses.test.js` cubre el detalle consolidado y 404; `frontend/src/__tests__/AdminPanel.test.jsx` cubre el boton `Ver detalle` y la ruta `/admin/processes/:id`.
- Commits realizados: `feat(admin-processes): add request detail route`, `docs(agents): note SCRUM-140 start`, `feat(admin-processes): implement request detail page`, `feat(admin-processes): integrate request detail modules` y `fix(admin-processes): satisfy request detail lint`.

## Instalacion y ejecucion

Instalar dependencias por paquete:

```bash
cd backend
npm ci

cd ../frontend
npm ci
```

Variables de entorno (ver `.env.example`, `backend/.env.example` y `frontend/.env.example` para la lista completa):

```text
# Base de datos (obligatorias)
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=change_me
DB_NAME=visa_db
# Sesion (obligatoria en produccion; sin ella el login falla)
SESSION_SECRET=<secreto largo y aleatorio>
NODE_ENV=development | production
# Storage
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=...
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
LOCAL_UPLOAD_DIR=backend/local_uploads
# CORS y frontend
CORS_ALLOWED_ORIGINS=http://localhost:5173,...
FRONTEND_URL=                     # base para enlaces de reset/verificacion
FRONTEND_API_URL=/api             # build arg del frontend en Docker
VITE_API_URL=
VITE_API_PORT=3000
VITE_WHATSAPP_PHONE=
# Correo
EMAIL_PROVIDER=smtp | resend
SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS / SMTP_FROM
RESEND_API_KEY=...
EMAIL_FROM=VisaGuide <...>
EMAIL_REMINDERS_MODE=dry_run | disabled | send
# Pago por transferencia
PAYMENT_BANK_NAME / PAYMENT_ACCOUNT_NAME / PAYMENT_ACCOUNT_NUMBER / PAYMENT_ACCOUNT_TYPE / PAYMENT_BANK_INSTRUCTIONS
```

Notas:

- Docker Compose carga `.env` desde la raiz de `visa-app/`.
- `backend/app.js` carga `backend/.env` con `dotenv` (no el de la raiz). En local fuera de Docker configure `backend/.env`.
- `SESSION_SECRET` es obligatorio con `NODE_ENV=production`. Fuera de produccion `auth.js` usa un secreto de desarrollo fijo.
- Con `NODE_ENV=development`, `app.js` crea cuentas de prueba (ver `testUsers` en `app.js`) y tramites de ejemplo al arrancar.
- `LOCAL_UPLOAD_DIR` es opcional; Docker lo define como `/app/local_uploads` y monta el volumen `local_uploads`.
- En `NODE_ENV !== "production"`, si R2 no esta configurado, `storage.js` guarda archivos localmente y el backend expone `/local-files`.
- Sin `RESEND_API_KEY` o sin credenciales SMTP, el transporte queda en `null` y los correos no se envian (dry-run).
- `frontend/src/config/api.js` resuelve `VITE_API_URL`: si es relativo (`/api`) lo usa tal cual; si esta vacio usa el host actual con `VITE_API_PORT`.

Con Docker:

```bash
cp .env.example .env
docker compose up --build
```

`docker compose up` aplica automaticamente `docker-compose.override.yml`, que fuerza `NODE_ENV=development` y un `SESSION_SECRET` de desarrollo. Para produccion use solo el archivo base: `docker compose -f docker-compose.yml up -d --build`.

Puertos por defecto:

- Frontend (Docker, Nginx): `http://localhost:8080`, que proxea `/api` al backend.
- Frontend (Vite dev): `http://localhost:5173`
- Backend: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`
- Postgres del host: `localhost:5433`, mapeado al contenedor `5432`

Sin Docker:

```bash
cd backend
npm start
```

```bash
cd frontend
npm run dev
```

Si se ejecuta sin Docker, use un `DB_HOST` accesible desde el host, normalmente `localhost`, no `db`.

## Comandos de calidad

Backend:

```bash
cd backend
npm test
npm run test:coverage
```

Frontend:

```bash
cd frontend
npm run lint
npm run test:run
npm run test:coverage
npm run build
```

Antes de cerrar una tarea, ejecute al menos las pruebas relacionadas con el area tocada. Para cambios transversales, corra backend tests, frontend tests, lint y build.

## Backend

### Patrones actuales

El backend usa CommonJS. Mantenga `require`/`module.exports`; no mezcle ESM.

Todas las rutas son modulares. `app.js` ya no define endpoints de negocio (solo `GET /`); crea el pool, ejecuta las migraciones ligeras, instancia servicios compartidos (notificaciones, activity log, recordatorios, consular) y monta los routers. Queda codigo muerto de antes del refactor en `app.js` (`ETAPAS_VALIDAS`, `MENSAJES_ETAPA`, `notificarCambioEtapa`, etc.); no lo use como referencia.

Los routers siguen el patron de fabrica: `createXRoutes(pool, { dependencias })`. Las dependencias (middlewares de auth, servicios, promesas `schemaReady`) se inyectan desde `app.js`, lo que permite mockearlas en pruebas.

Para funcionalidad nueva use:

```text
routes/<dominio>Routes.js
controllers/<dominio>Controller.js   # opcional; algunos dominios (admin, advisor, chat, consular) manejan HTTP en la ruta
services/<dominio>Service.js
```

Monte la ruta en `app.js` con `app.use(...)` antes de `notFoundHandler`/`errorHandler`.

### Autenticacion y autorizacion

- `POST /login` y `POST /register` devuelven `token`. El cliente lo envia como `Authorization: Bearer <token>`.
- El token (`auth.js`) es `base64url(payload).HMAC-SHA256` firmado con `SESSION_SECRET`, con `sub`, `correo`, `rol` y `exp` (8 horas). No hay revocacion: cambiar la contrasena no invalida tokens emitidos.
- `createSessionMiddleware(pool)` (`requireSession`) valida el token y vuelve a leer el usuario en BD; rechaza cuentas con `activo = false`. Deja el usuario en `req.auth`.
- `createRoleMiddleware(pool, roles)` genera `requireAdmin`, `requireAdvisor` (`asesor`) y `requireStaff` (`asesor` + `admin`).
- En endpoints nuevos tome el usuario de `req.auth`, nunca de `correo`/`userId` enviados por el cliente, y valide propiedad del recurso.
- `email_verificado` se guarda y se muestra como aviso, pero no bloquea el acceso.
- Para `navigator.sendBeacon` (sin headers), las rutas DS-160 aceptan `token` en el body y lo promueven a `Authorization`.

### Base de datos

La app usa `pg.Pool` creado en `backend/app.js`. Las tablas base estan en `init.sql`:

- `usuario`
- `tramite`
- `formulario_ds160`
- `documentos`
- `question_bank`
- `interview_sessions`
- `notificaciones`

Otras tablas y columnas se crean al arrancar, no en `init.sql`:

- En `app.js`: columnas extra de `usuario` (`rol`, `activo`, `email_verificado`, preferencias, capacidad de asesor), `tramite.id_asesor`, `process_change_history`, `password_resets`, `email_verifications`, `admin_settings`, `admin_activity`.
- En servicios con `ensureSchema()`: notificaciones, sesiones de entrevista, banco de preguntas, pagos y citas consulares, activity logs y recordatorios por email.

Las promesas `userSchemaReady`, `tramiteSchemaReady`, `adminSchemaReady`, etc. se pasan a los routers; espere la que corresponda antes de consultar tablas que dependan de ellas. Si cambia esquema:

- Actualice `init.sql`.
- Actualice tambien los `ensureSchema()` o migraciones ligeras existentes si la app depende de que se autocorrija en ambientes ya creados.
- Use queries parametrizadas con `$1`, `$2`, etc. No concatene valores del usuario en SQL.

### Rutas principales

La lista completa y actualizada esta en Swagger (`/api-docs`, fuente `backend/docs/openapi.js`). Proteccion indicada entre corchetes: [publica], [sesion], [admin], [asesor], [staff].

Auth/sesion (`authRoutes.js`):

- `POST /register`, `POST /login` [publica]
- `GET /validar-sesion` [sesion]
- `POST /forgot-password`, `POST /reset-password` [publica]
- `POST /verificar-email`, `POST /reenviar-verificacion` [publica]

Perfil/tramite (`perfilRoutes.js`) — **sin middleware de sesion; identifican al usuario por `correo` en el body** (ver Riesgos):

- `POST /guardar-perfil`
- `POST /estado-tramite` con `{ correo }`
- `POST /usuario-perfil` con `{ correo }`, `PUT /usuario-perfil`
- `PUT /tramite` con `{ id_tramite, ... }`

DS-160 (`ds160Routes.js`) [sesion; usa `req.auth`, no `correo`]:

- `POST /ds160/load`, `POST /ds160`, `POST /ds160/pdf`

Documentos/uploads (`documentRoutes.js`) [sesion; cliente solo los propios, `asesor`/`admin` cualquiera]:

- `POST /upload`, `POST /documentos` (multipart, campo `file`)
- `POST /documentos/listar` con `{ usuario_id }`, `GET /documentos/:usuarioId`
- `GET /documentos/:id/archivo`
- `DELETE /documentos/:id`, `DELETE /documentos` con `{ documento_id, usuario_id }`

Banco de preguntas (`questionBankRoutes.js`):

- `GET /questions` [publica]
- `GET /questions/admin`, `POST /questions`, `PUT /questions/:id`, `PATCH /questions/:id/status`, `DELETE /questions/:id` [admin]

Entrevistas (`interviewSessionRoutes.js`):

- `GET /interview-sessions`, `PUT /interview-sessions/:id/feedback` [admin]
- `POST /interview-sessions` (multipart, campos `audio_*`), `POST /interview-sessions/user`, `POST /interview-sessions/detail`, `GET /interview-sessions/user/:userId`, `GET /interview-sessions/:id`, `GET /interview-sessions/:id/audio/:questionId` — **sin middleware de sesion** (ver Riesgos)

Notificaciones (`notificacionRoutes.js`) [sesion + propietario o admin]:

- `POST /notificaciones` [admin]
- `POST /notificaciones/no-leidas`, `POST /notificaciones/listar`, `PUT /notificaciones/leer-todas` con `{ userId }`
- `GET /notificaciones/:userId/no-leidas`, `GET /notificaciones/:userId`
- `PUT /notificaciones/:id/leer`, `DELETE /notificaciones/:id` con `{ userId }`
- `PUT /notificaciones/:userId/leer-todas` es legacy y responde 405

Chat cliente-asesor (`chatRoutes.js`) [sesion, rol `cliente`]:

- `GET /chat`, `POST /chat/messages`

Consular y pagos (`consularRoutes.js`):

- `GET /payments/me`, `POST /payments/bank-transfer`, `GET /appointments/me` [sesion]
- `GET /staff/consular-cases`, `POST /staff/consular-payments/:id/start|review-transfer|receipt`, `PUT /staff/consular-cases/:userId/appointment`, `POST /staff/consular-cases/:userId/appointments/:id/cancel` [staff]

Administracion [admin]:

- `/admin/metrics`: `overview`, `processes`, `processes.csv`, `processes.xlsx`
- `/admin/documents`: `GET /`, `PUT /:id/status`
- `/admin/processes`: `GET /`, `GET /:id`, `GET /:id/history`, `PUT /:id`
- `/admin`: `dashboard`, `users`, `advisors`, `assignments`, `ds160`, `profile`, `settings`, `activity-logs`, `POST /email-reminders/run`

Asesor (`advisorRoutes.js`) [asesor; todo filtrado por `tramite.id_asesor = req.auth.id_usuario`]:

- `/advisor`: `dashboard`, `processes`, `documents`, `ds160`, `interviews`, `conversations`, `tasks`, `questions`, `profile`

### Storage, R2 y archivos

Uploads usan `multer.memoryStorage()` y deben pasar por `backend/storage.js`, no directamente por `r2.js`. La abstraccion decide:

- Produccion o R2 bien configurado: sube a Cloudflare R2.
- Desarrollo/test sin R2 valido: guarda en `LOCAL_UPLOAD_DIR` o `backend/local_uploads`.

`app.js` sirve archivos locales solo fuera de produccion:

```js
if (process.env.NODE_ENV !== "production") {
  app.use("/local-files", express.static(LOCAL_STORAGE_DIR));
}
```

`r2.js` valida que estas variables existan y no sean placeholders:

- `R2_ACCESS_KEY`
- `R2_SECRET_KEY`
- `R2_BUCKET`
- `R2_ENDPOINT`

En pruebas, `storage.js` y/o R2 se mockean. No llame R2 real desde tests unitarios/integracion local.

Cuando cree endpoints de upload:

- Valide archivo requerido antes de subir.
- Use `uploadStoredFile(file, { baseUrl })` antes de persistir si necesita URL final.
- Si falla la persistencia despues del upload, haga cleanup con `deleteStoredFile`.
- Guarde `storage_key` cuando se necesite eliminar/reemplazar archivos.
- Guarde y respete `provider` cuando el caller lo necesite, pero la llave `storage_key` debe bastar para eliminar.

### Manejo de errores

Los servicios modulares usan `error.statusCode` para respuestas esperadas. Los controladores convierten errores no esperados en mensajes genericos y registran `console.error`. Al final de `app.js`, `upload.handleUploadError`, `notFoundHandler` y `errorHandler` (`middleware/errorHandler.js`) responden `{ error }` y ocultan el mensaje en errores 5xx.

Algunos controladores antiguos (auth, perfil, DS-160) todavia devuelven `error.message` en respuestas 500; no copie ese patron.

Mantenga ese patron:

```js
const error = new Error("Mensaje para el cliente");
error.statusCode = 400;
throw error;
```

## Frontend

### Patrones actuales

El frontend usa React 19, Vite, React Router y `lucide-react`. No hay TypeScript.

`App.jsx` carga paginas con `lazy`/`Suspense` (ver tambien `routes/lazyRoutes.js`). La ruta `/` redirige a `/login`; ya no existe una pantalla de onboarding como landing inicial. Login, registro, `/recuperar-contrasena`, `/restablecer-contrasena` y `/verificar-email` usan `AuthLayout` en `frontend/src/components/auth/`.

Guardas de rol en el router: `RequireAdmin` para `/admin/*`, `RequireAdvisor` para `/advisor/*` y `RequireStaff` para `/gestion-consular`. Son solo UX; la autorizacion real la hace el backend.

Rutas principales estan en `frontend/src/App.jsx`. Al agregar una pantalla:

1. Crear pagina en `frontend/src/pages/`.
2. Importarla en `App.jsx`.
3. Registrar `<Route path="..." element={<... />} />`.
4. Si debe aparecer en navegacion autenticada, actualizar `frontend/src/components/Sidebar.jsx`.
5. Agregar CSS en `frontend/src/styles/` o junto al componente si el area ya usa ese patron.

Para llamadas HTTP, use siempre:

```js
import { buildApiUrl } from "../config/api";

fetch(buildApiUrl("/ruta"))
```

Para endpoints protegidos agregue el token con `buildSessionHeaders()` de `utils/sessionAuth.js`. Para codigo nuevo prefiera `apiRequest()` de `utils/apiClient.js`: aplica timeout (15 s), lanza `ApiError` con mensajes en espanol por codigo HTTP y limpia la sesion ante 401. Los paneles usan `utils/adminHeaders.js` y `utils/advisorApi.js`.

No construya URLs con `import.meta.env.VITE_API_URL` directamente; solo `config/api.js` lo lee.

### Sesion y auth

La sesion del usuario se guarda en `localStorage`:

- `visaguide_session`: JSON con `id`, `nombre`, `correo`, `perfil`, `rol`, `emailVerificado`, `token` y `loginTime`.
- `correoUsuario`: compatibilidad con flujos antiguos.
- `perfilUsuario`: compatibilidad con seleccion de perfil.

Para pantallas privadas use `useRequireAuth()`:

```js
const { isValidating, session } = useRequireAuth();
```

Ese hook valida contra `GET /validar-sesion` y redirige a `/login` si la sesion no existe o no es valida.

Flujo actual:

- `/` redirige a `/login`.
- Login exitoso envia a `/dashboard` si el usuario ya tiene `perfil`; de lo contrario a `/seleccion-perfil`.
- Registro exitoso guarda `visaguide_session`, actualiza `correoUsuario` y envia directo a `/seleccion-perfil`.
- Auth usa formularios reales, `Link`/`useNavigate` donde aplica y controles de mostrar/ocultar contrasena.

### UI y estilos

Convenciones visibles:

- Layout autenticado con `Sidebar`.
- Acciones superiores compartidas con `TopActions` y `NotificationCenter`.
- Marca reutilizable con `VisaGuideLogo`.
- Auth reutilizable con `AuthLayout` y `components/auth/auth.css`.
- Modo oscuro via `useTheme()` y atributo `data-theme` en `document.documentElement`.
- Modo Senior via `useModoSenior()` y `localStorage.modoSenior`.
- Tokens globales de layout, color y tipografia en `frontend/src/index.css` usando variables `--vg-*`.
- Muchas pantallas usan CSS por dominio en `frontend/src/styles/*.css`.
- Algunas pantallas y componentes todavia usan estilos inline extensos. Si edita una pantalla, siga el patron local de esa pantalla en lugar de reestructurar todo.
- Use iconos de `lucide-react` para componentes nuevos cuando haya un icono equivalente. Mantenga SVG inline solo si el componente existente ya los usa y el cambio es local.
- Mantenga etiquetas y textos en espanol.
- Tenga cuidado con responsive/mobile: `Sidebar` tiene comportamiento especial en <= 768px.

### Paginas principales

- `Dashboard.jsx`: estado del tramite.
- `InformationSection.jsx`: bloque reutilizado en Dashboard para informacion del proceso.
- `ProfileSelection/ProfileSelection.jsx`: seleccion de tipo de perfil/visa.
- `Perfil/Perfil.jsx`: datos personales, preferencias y resumen del tramite.
- `ds160.jsx`: formulario DS-160 por secciones.
- `Documents.jsx`: documentos requeridos y estado de revision.
- `Entrevista.jsx`: preparacion y resumen de sesiones.
- `InterviewSimulator.jsx`: simulador con grabacion/audio y envio a backend.
- `InterviewFeedback.jsx`: revision de sesiones/feedback.
- `QuestionBank.jsx`: CRUD de preguntas y revision de entrevistas.
- `Notificaciones.jsx`: lista y marcado de notificaciones.
- `Chat.jsx`: chat del cliente con su asesor (`/chat`).
- `ConsularPayment.jsx` (`/pagos`), `ConsularAppointments.jsx` (`/citas`) y `ConsularManagement.jsx` (`/gestion-consular`, staff).
- `Cronologia.jsx`, `Informacion.jsx`: pantallas informativas/de apoyo.
- `Upload.jsx` (`/upload`): pantalla legacy de subida.
- `pages/admin/*`: dashboard, usuarios, asesores, asignaciones, tramites y detalle, documentos, DS-160, entrevistas, preguntas, reportes, logs de actividad, recordatorios por email, ajustes y perfil.
- `pages/advisor/*`: dashboard, solicitudes, documentos, DS-160, entrevistas, chat, tareas, preguntas y perfil.

## Pruebas

### Backend

Jest esta configurado en `backend/jest.config.js`.

- Ninguna prueba usa una base real: CI no levanta PostgreSQL.
- `pg` y `storage.js` se mockean en `backend/__tests__/app.test.js`; las pruebas usan Supertest contra `require("../app")`.
- Las pruebas de integracion (`*.integration.test.js`) usan los harnesses de `backend/test-utils/` (auth, documentos, DS-160), que simulan la BD en memoria, y `fakeStorage.js`.
- Hay suites de seguridad (`security.test.js`, `protectedEndpoints.security.test.js`, `tokensSessions.security.test.js`, `cors.test.js`) y de autorizacion por rol.
- R2 y el correo se mockean para no tocar servicios reales.
- `backend/__tests__/storage.test.js` valida el fallback local de desarrollo/test.

Al agregar endpoints:

- Agregue casos felices, errores de validacion, 401 sin token y 403 con otro rol u otro usuario.
- Mockee queries nuevas en `defaultQueryHandler` o en el harness correspondiente.
- Si agrega servicios puros, considere pruebas enfocadas de servicio.

Pruebas de carga: `tests/load-test.js` (k6), no forman parte de CI.

### Frontend

Vitest esta configurado en `frontend/vite.config.js` con:

- `globals: true`
- `environment: "jsdom"`
- `setupFiles: "./src/setupTests.js"`

`setupTests.js` limpia `localStorage`, `sessionStorage`, env vars y mocks despues de cada prueba.

Al agregar UI:

- Testee estados importantes: loading, error, datos renderizados y acciones del usuario.
- Mockee `fetch` cuando el componente consuma backend.
- Para hooks que redirigen con `window.location.href`, revise los tests existentes de `useRequireAuth`.
- Para cambios de auth, revise `Auth.test.jsx`.
- Para componentes compartidos de marca, revise `VisaGuideLogo.test.jsx`.
- Para persistencia del DS-160, revise `DS160Persistence.test.jsx`.

## Datos y seguridad

Estado actual:

- Contrasenas con bcrypt (10 rondas). `authService.verifyPassword` todavia acepta contrasenas legacy en texto plano y las migra a bcrypt al primer login.
- Tokens de reset y verificacion: 32 bytes aleatorios; en BD solo se guarda su SHA-256. Reset valido 1 hora, verificacion 24 horas.
- Token de sesion firmado con HMAC (ver "Autenticacion y autorizacion"); se guarda en `localStorage`.
- CORS restringido por `CORS_ALLOWED_ORIGINS` o por los defaults de `config/cors.js`; `credentials: false`.
- Uploads: maximo 5 MB y 8 archivos; documentos solo `.pdf/.jpg/.jpeg/.png` y audio solo `.webm`, validando extension y MIME.
- Queries parametrizadas en todo el backend.

Pendientes conocidos, en orden de prioridad (no los "arregle" de paso sin pedido del usuario, pero no los replique en codigo nuevo):

1. `perfilRoutes.js` e `interviewSessionRoutes.js` (excepto listado y feedback admin) no exigen sesion: se puede leer o modificar el perfil/tramite de otro usuario con su correo o `id_tramite`, y descargar audios de entrevistas por ID.
2. `docker-compose.override.yml` tiene un `SESSION_SECRET` commiteado y fuerza `NODE_ENV=development`; si se despliega con `docker compose up` sin `-f`, se crean las cuentas de prueba y se pueden falsificar tokens.
3. `config/email.js` usa `tls.rejectUnauthorized: false` con Resend.
4. Sin rate limiting en login, recuperacion y reenvio de verificacion; sin `helmet` ni cabeceras de seguridad en Nginx.
5. Politica de contrasenas debil: el registro no exige longitud y el reset pide 4 caracteres. El login no normaliza el correo a minusculas (el registro si).
6. Cualquier `asesor` puede ver y borrar documentos de todos los clientes via `/documentos/*`, aunque `/advisor/*` si filtra por asignacion.
7. Dependencias con vulnerabilidades conocidas (`npm audit` en backend y frontend).

No registre secretos ni datos sensibles en consola. No commitee `.env`, `backend/.env`, `node_modules`, `dist` ni artefactos de coverage, y no ponga credenciales reales en los `.env.example`.

## Documentacion y entregables

`docs/` contiene material academico:

- `documento-academico.md`
- `estrategia-pruebas.md`
- `presentacion.md`
- `guion-video.md`
- `checklist-rubrica.md`
- `prompt-presentacion.md`
- `auditoria-dashboard-admin.md`, `bugs-corregidos-rf98.md`
- `entregables/` con PDF/DOCX/XLSX/imagenes generadas

Y documentacion operativa:

- `backups-postgresql.md`: respaldo, rotacion y restauracion de PostgreSQL (scripts en `tools/backups/`).
- `server-monitoring.md`: monitoreo de CPU, memoria, disco y HTTP en el host EC2 cada 5 minutos con alertas por correo (scripts en `tools/monitoring/`).

`tools/` contiene:

- Scripts Python (`build_academic_docx.py`, `build_academic_pdf.py`, `make_pdf_contact_sheet.py`) para regenerar entregables; no edite binarios manualmente.
- `tools/backups/` y `tools/monitoring/`: scripts bash para el servidor, con `*.example` de configuracion y scripts `validate_*.sh`. Se instalan por cron en el host, fuera de Docker.

## Flujo recomendado para agentes

Antes de editar:

1. Lea los archivos relevantes con `rg`/`rg --files`.
2. Identifique si el cambio cae en frontend, backend, DB, docs o varios.
3. Revise pruebas existentes del mismo patron.
4. Si toca esquema, actualice `init.sql` y cualquier `ensureSchema()`.
5. Si toca API, actualice tanto backend como consumidores frontend.

Durante la edicion:

- Mantenga cambios pequenos y enfocados.
- Respete CommonJS en backend y ESM en frontend.
- Use `buildApiUrl` para requests frontend.
- No cambie rutas, nombres de campos ni estructura de respuestas sin revisar consumidores.
- No borre cambios ajenos ni regenere coverage sin necesidad.

Antes de entregar:

1. Ejecute pruebas relacionadas.
2. Ejecute lint/build si toca frontend.
3. Verifique manualmente rutas criticas si hubo cambios visuales o de flujo.
4. Reporte comandos ejecutados y cualquier cosa que no se pudo validar.

## Checklist por tipo de cambio

Backend endpoint nuevo:

- Ruta en `routes/`.
- Middleware de sesion/rol aplicado y propiedad del recurso validada con `req.auth`.
- Controlador con errores consistentes.
- Servicio con validacion y SQL parametrizado.
- Montaje en `app.js`.
- Pruebas con Supertest (incluyendo 401/403).
- Actualizacion de `init.sql` si hay tabla/columna nueva.
- Documentacion en `backend/docs/openapi.js`.

Frontend pantalla nueva:

- Pagina creada en `src/pages/`.
- Ruta agregada en `App.jsx`.
- Sidebar actualizado si aplica.
- CSS siguiendo el patron local.
- Estados de loading/error/success.
- Prueba de render y acciones principales.

Integracion frontend-backend:

- Endpoint backend validado.
- `buildApiUrl` en frontend.
- Manejo de `response.ok`.
- Mensajes de error utiles.
- Tests de API/componentes actualizados.

Upload/documentos/audio:

- Validacion de archivo y metadatos.
- Uso de `uploadStoredFile`, no llamadas directas a R2 desde endpoints nuevos.
- Configuracion R2 validada en produccion; fallback local permitido solo fuera de produccion.
- Cleanup con `deleteStoredFile` si falla persistencia.
- `storage_key` guardado para reemplazo/eliminacion.
- Tests sin tocar R2 real.

Base de datos:

- `init.sql` actualizado.
- `ensureSchema()` actualizado si aplica.
- Indices/constraints para consultas frecuentes o unicidad.
- Compatibilidad con datos existentes.

## Riesgos conocidos y trampas

- `docker-compose.yml` construye el frontend con `VITE_API_URL=${FRONTEND_API_URL:-/api}`; el Nginx del contenedor proxea `/api/` al backend. Backend (`3000`) y frontend (`8080`) se publican solo en `127.0.0.1`; Postgres (`5433`) se publica en todas las interfaces.
- `docker-compose.yml` usa `NODE_ENV=${NODE_ENV:-production}`, pero `docker-compose.override.yml` lo sobrescribe a `development` cuando se usa `docker compose up` sin `-f`. Ver "Datos y seguridad".
- El `Dockerfile` del backend fija `NODE_ENV=production` y usa `node:20`; CI usa Node 22.
- `LOCAL_UPLOAD_DIR=/app/local_uploads` vive en el volumen `local_uploads`; los archivos locales no deben asumirse persistidos en el filesystem del host salvo que el volumen se conserve.
- El servidor publico usa dos Nginx: el del host (`nginx/visa-app.duckdns.org.conf`, que envia `/api/` a `127.0.0.1:3000` y el resto a `127.0.0.1:8080`) y el del contenedor del frontend (`frontend/nginx.conf`). Los cambios de proxy pueden requerir tocar ambos.
- CI solo corre en push/PR a `main`; las ramas de trabajo no se prueban hasta abrir el PR.
- El `package.json` de `visa-app/` solo declara `cors` y no se usa; los scripts reales estan en `backend/package.json` y `frontend/package.json`.
- Algunos archivos muestran caracteres mojibake en terminal Windows si la consola no esta en UTF-8. Antes de "corregir" textos, confirme que el archivo realmente este mal y no sea solo la salida de PowerShell.
- `app.js` concentra migraciones, seed y wiring. No agregue endpoints ahi; cree un router.
- Los endpoints de documentos existen como `/upload` y `/documentos`; revise consumidores antes de consolidar.
- El fallback local expone `/local-files` sin autenticacion cuando `NODE_ENV !== "production"`; no construya flujos de produccion que dependan de esa ruta.
- El endpoint de audio `GET /interview-sessions/:id/audio/:questionId` se consume con `<audio src>`, que no envia `Authorization`. Si se protege, habra que usar URL firmada, cookie o descarga via `fetch` + `blob:`.
- `localStorage` tiene llaves legacy (`correoUsuario`, `perfilUsuario`) usadas por varias pantallas. No las elimine sin migracion.
- Puede haber archivos sueltos sin seguimiento (por ejemplo `temp_app.js`, una copia vieja de `app.js` en UTF-16). No los use como referencia.

## Estado esperado de calidad

Una contribucion lista deberia:

- Mantener el flujo de usuario existente.
- No introducir llamadas directas a URLs hardcodeadas desde componentes nuevos.
- Usar componentes compartidos existentes para auth, marca, top actions y notificaciones cuando aplique.
- No romper modo oscuro ni modo Senior en pantallas autenticadas.
- Validar inputs del backend antes de tocar DB o storage.
- Incluir pruebas proporcionales al cambio.
- Documentar cualquier limitacion o validacion no ejecutada.
