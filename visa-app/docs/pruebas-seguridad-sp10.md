# SP10-21: re-ejecución de pruebas de seguridad

**Fecha:** 27 de octubre de 2026. **Código probado:** `main` en el commit `072366a`.

Objetivo: volver a probar los 10 hallazgos de seguridad del Sprint 9 (S-01 a S-10) después de las correcciones del Sprint 10 y comparar el antes y el después.

## 1. Cómo se probó

| Prueba | Herramienta | Sprint 9 | Sprint 10 |
|---|---|---|---|
| Pruebas automatizadas de seguridad | Jest + Supertest | 143 pruebas | 232 pruebas (ver sección 3) |
| Dependencias vulnerables | `npm audit` | Backend y frontend | Backend, frontend y E2E |
| Control de acceso, errores, cabeceras y rate limiting | Script propio con `curl` (`tests/seguridad/verificar-produccion.sh`) | Peticiones manuales en local | Contra **producción**, solo peticiones sin sesión que no crean cuentas ni datos |
| DAST | OWASP ZAP (pasivo + activo de API) | App local en Docker | **No se repitió** (ver sección 5) |
| Fuerza bruta | k6 (`tests/seguridad/fuerza-bruta.js`) | App local en Docker | Cubierta por pruebas automatizadas de concurrencia (ver S-06) |

En el Sprint 9 todo se ejecutó en local. Esta vez Docker Desktop no pudo arrancar en el equipo de pruebas (fallo interno de WSL), así que la verificación dinámica se hizo contra producción, limitada a peticiones no intrusivas. El escaneo activo de ZAP y la fuerza bruta contra una cuenta no se ejecutaron en producción porque modifican datos reales, envían correos y bloquean cuentas.

## 2. Resultado por hallazgo

| ID | Hallazgo del Sprint 9 | Riesgo | Antes | Después | Estado |
|---|---|---|---|---|---|
| S-01 | IDOR en perfil y trámite | Alto | Sin token y con el correo de la víctima se leían y modificaban sus datos (HTTP 200). | Las 5 rutas de perfil/trámite, documentos y entrevistas responden **401** sin token y con un token falsificado. El asesor solo accede a documentos y entrevistas de sus clientes asignados (SP10-01, 02 y 07). | ✅ Corregido |
| S-02 | Errores de PostgreSQL expuestos (500) | Medio | HTTP 500 con mensajes como `value too long for type character varying(10)`. | Las entradas inválidas responden 4xx sin detalles de la base; los 5xx devuelven un mensaje genérico con `X-Request-Id` (SP10-06). Detalle menor: con un JSON mal formado, el login devuelve el mensaje del parser de JSON. | ✅ Corregido |
| S-03 | Falta Content-Security-Policy | Medio | Ausente en frontend y API. | La API responde JSON, y Swagger (`/api-docs`) tiene una CSP estricta. **El frontend sigue sin CSP.** | 🟡 Parcial |
| S-04 | Sin protección contra clickjacking | Medio | Ausente. | La API envía `X-Frame-Options: SAMEORIGIN`. **El frontend no la envía.** | 🟡 Parcial |
| S-05 | Política de contraseñas débil | Medio | Se aceptaba la contraseña "1"; el restablecimiento pedía 4 caracteres. | Registro y restablecimiento exigen 8+ caracteres con letras y números, con mensajes claros en el frontend (SP10-05). 20 pruebas automatizadas. | ✅ Corregido |
| S-06 | Condición de carrera en el bloqueo | Bajo-Medio | 22 intentos evaluados en vez de 5 y 18 bloqueos (hasta 18 correos). | El conteo y el bloqueo se serializan por usuario en una transacción (`SELECT … FOR UPDATE`): un solo bloqueo y un solo aviso ante intentos concurrentes (SP10-09). Además, el login tiene rate limiting. | ✅ Corregido |
| S-07 | Faltan cabeceras de endurecimiento | Bajo | Ausentes. | La API envía `X-Content-Type-Options`, `Permissions-Policy`, `Referrer-Policy` y `Cross-Origin-*-Policy` (helmet). **El frontend no las envía.** | 🟡 Parcial |
| S-08 | Se divulgan versiones de software | Bajo | `X-Powered-By: Express` y `Server: nginx/…`. | `X-Powered-By` eliminado. **Producción sigue mostrando `Server: nginx/1.24.0 (Ubuntu)`.** | 🟡 Parcial |
| S-09 | Sin HSTS en producción | Bajo | Ausente. | La API envía `Strict-Transport-Security: max-age=31536000; includeSubDomains`. **Las páginas del frontend no.** HTTP sigue redirigiendo a HTTPS (301). | 🟡 Parcial |
| S-10 | 500 en `forgot-password` y `reenviar-verificacion` con cuerpo malformado | Bajo | HTTP 500. | Responden con el mensaje genérico de siempre, sin revelar si el correo existe. | ✅ Corregido |

**Resumen:** de 10 hallazgos, **5 corregidos** (incluido el único de riesgo alto) y **5 parciales**. Los 5 parciales tienen la misma causa: faltan las cabeceras de seguridad y `server_tokens off` en Nginx (la parte de Nginx de SP10-03). Express ya las envía, pero las páginas del frontend las sirve Nginx directamente.

Controles nuevos que no existían en el Sprint 9:

- **Rate limiting en producción:** el login respondió 401 en los primeros intentos con un correo inexistente y **429** al llegar a 10 intentos.
- **Invalidación de sesiones:** restablecer la contraseña invalida todas las sesiones anteriores (SP10-10).
- **Consentimiento de privacidad** en el registro (SP10-12).

## 3. Pruebas automatizadas

Backend: **700 pruebas**. En el CI de `main` pasan todas. En el equipo de pruebas fallaron 4 por exceder 5 s (registro con bcrypt y validación de Swagger) mientras Docker consumía recursos; no son fallas de lógica.

| Grupo | Sprint 9 | Sprint 10 |
|---|---|---|
| Endpoints protegidos | 100 | 100 |
| Tokens y sesiones | 17 | 19 |
| Seguridad general | 9 | 9 |
| CORS | 5 | 5 |
| Bloqueo de cuenta (incluye concurrencia) | 10 | 12 |
| Credenciales del seed | 2 | 2 |
| Perfil y trámite con sesión (IDOR) | — | 16 |
| Acceso del asesor a documentos y entrevistas | — | 19 |
| Política de contraseñas | — | 20 |
| Recuperación de cuenta e invalidación de sesiones | — | 15 |
| Manejo de errores | — | 7 |
| Cabeceras de seguridad | — | 4 |
| Rate limiting | — | 4 |
| **Total** | **143** | **232** |

## 4. Dependencias (`npm audit`)

| Proyecto | Fin del Sprint 9 | Sprint 10 |
|---|---|---|
| Backend | 0 | 0 |
| Frontend | 0 | 3 moderadas |
| E2E | — | 0 |

Las 3 del frontend están en `vitest`, la herramienta de pruebas: es una dependencia de desarrollo que no forma parte del build desplegado. Tienen corrección disponible (actualizar `vitest`). El CI solo bloquea vulnerabilidades altas y críticas, y no hay ninguna.

## 5. Limitaciones

- **ZAP no se repitió.** Requiere Docker para la app local, y el escaneo activo no debe correrse contra producción. Sus hallazgos se verificaron uno por uno: los de configuración (S-03, S-04, S-07, S-08) revisando las cabeceras en producción, y S-02 y S-10 con peticiones malformadas.
- **La fuerza bruta con k6 no se repitió.** La condición de carrera (S-06) queda respaldada por las pruebas de concurrencia de `accountLockout.integration.test.js`, que pasan en CI.
- **Certificado TLS.** El antivirus Avast del equipo de pruebas intercepta HTTPS, así que no se pudo leer el certificado real. Las fechas que replica Avast (24/09/2026 a 23/12/2026) corresponden a la renovación de Let's Encrypt y coinciden con el certificado registrado en el Sprint 9.

## 6. Pendientes

| Prioridad | Pendiente | Acción |
|---|---|---|
| 1 | Cabeceras en el frontend (S-03, S-04, S-07, S-09) | `add_header` en `nginx/visa-app.duckdns.org.conf` y `frontend/nginx.conf`: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y HSTS, con `always`. |
| 2 | Versión de Nginx visible (S-08) | `server_tokens off;` en ambos Nginx. |
| 3 | Mensaje del parser de JSON en el login | Devolver un mensaje genérico ("Solicitud inválida") cuando el cuerpo no es JSON válido. |
| 4 | `vitest` con 3 vulnerabilidades moderadas | Actualizar `vitest` y `@vitest/coverage-v8`. |
| 5 | Repetir ZAP | Cuando haya un entorno local o de staging, repetir el escaneo pasivo y activo para cerrar la comparación. |
