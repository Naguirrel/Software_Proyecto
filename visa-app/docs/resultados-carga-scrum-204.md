# SCRUM-204 — Prueba de carga con 200 usuarios virtuales

## Objetivo y RNF-9

Se probó el flujo autenticado de VisaGuide con un perfil de humo y luego con hasta 200 usuarios virtuales (VUs) contra Docker local. La definición literal de RNF-9 es: «El sistema deberá soportar al menos 200 usuarios concurrentes sin degradación crítica del servicio». Fuente: `Corte 2/Software Proyecto Corte 2.pdf`, página 37, relativa a la raíz del repositorio Git. La tabla clasifica el requisito como «Rendimiento» y propone «Pruebas de carga simuladas».

RNF-9 no fija umbrales numéricos de latencia o error. Para esta ejecución se aprobaron criterios operativos adicionales: alcanzar y sostener 200 VUs durante cinco minutos, no observar indisponibilidad general, menos del 5 % de solicitudes fallidas, p95 global menor a 2 s y más del 95 % de checks correctos. Estos umbrales operativos no son texto de RNF-9.

## Entorno y datos

- Fecha: 7 de octubre de 2026. Smoke finalizado a las 08:18:51 UTC y full a las 08:35:34 UTC.
- Destino único: `http://localhost:8080/api`, mediante Nginx del contenedor frontend hacia el backend y PostgreSQL locales. Generador k6 en Windows, en el mismo equipo que Docker.
- Docker Engine y cliente 29.7.2; Docker tenía asignados 3 CPU y 3.050.823.680 bytes de memoria (aprox. 2,84 GiB). PostgreSQL 15.17 (Debian 15.17-1.pgdg13+1); k6 2.2.0, windows/amd64.
- `docker compose ps` mostró backend y frontend activos y PostgreSQL saludable antes y después de full. No se observó ningún reinicio durante los 22 muestreos de recursos.
- `tests/users.local.json` contenía una única cuenta cliente sembrada y validada mediante login HTTP 200. Los 200 VUs la reutilizaron: 199 VUs compartieron la cuenta asignada al primero. No se registraron credenciales, tokens ni cuerpos de respuesta en los resultados.
- Los JSON y logs de ejecución quedaron en `tests/results/`, ignorados por Git. La cuenta local también está ignorada.

## Configuración y flujo

`TEST_PROFILE` es obligatorio: solo admite `smoke` o `full`; un valor ausente o inválido falla antes de enviar tráfico. Se ejecutaron los siguientes comandos desde `visa-app/`:

```bash
k6 run -e TEST_PROFILE=smoke -e BASE_URL=http://localhost:8080/api \
  -e USERS_FILE=./users.local.json tests/load-test.js
k6 run -e TEST_PROFILE=full -e BASE_URL=http://localhost:8080/api \
  -e USERS_FILE=./users.local.json tests/load-test.js
```

En PowerShell se escribe cada comando en una sola línea. Smoke empleó `constant-vus`, 1 VU, 30 s. Full empleó `ramping-vus`: 1 min a 25, 1 min a 50, 1 min a 100, 1 min a 150, 1 min a 200, 5 min sostenidos en 200 y 2 min de descenso; duración nominal de 12 min. El progreso de k6 registró 200/200 VUs desde 05m01s hasta 10m02s, unos 5m01s observados. La ejecución completa tardó aproximadamente 12m02s y terminó con código 0, sin iteraciones interrumpidas.

Cada VU inició sesión una vez con `POST /login`; después repitió `GET /validar-sesion`, `POST /ds160/load` y `POST /documentos/listar`, con pausas de 1 a 3 s. Los dos POST posteriores al login son lecturas según los controladores actuales. Se exigió HTTP 200 en los checks y se deshabilitaron redirecciones. El login puede generar registros de actividad persistentes: en full hubo 200 logins.

## Resultados

| Métrica | Smoke | Full | Criterio full |
| --- | ---: | ---: | --- |
| VUs máximos | 1 | 200 | 200 y meseta de 5 min: cumple |
| Iteraciones completas | 5 | 16.330 | Informativo |
| Solicitudes HTTP | 16 | 49.190 | Informativo |
| Solicitudes por segundo | 0,530 | 68,142 | Informativo |
| Checks correctos / fallidos | 16 / 0 | 49.190 / 0 | Más del 95 %: cumple, 100 % |
| Tasa de solicitudes fallidas | 0 % | 0 % | Menos del 5 %: cumple |
| Duración global p50 | 4,356 ms | 2,702 ms | Informativo |
| Duración global p95 | 30,472 ms | 4,301 ms | Menos de 2.000 ms: cumple |
| Duración global p99 | 69,067 ms | 5,702 ms | Informativo |
| Duración global máxima | 78,716 ms | 99,329 ms | Informativo |

Los tres thresholds configurados en k6 para full (`http_req_failed`, `http_req_duration` y `checks`) se aprobaron. Los tres thresholds funcionales de smoke también se aprobaron: 0 % de fallos, p95 < 2.000 ms y 100 % de checks.

### Métricas full por endpoint

| Endpoint | Solicitudes | Fallos | Checks correctos | p50 | p95 | p99 | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `POST /login` | 200 | 0 | 200 | 50,523 ms | 56,076 ms | 83,006 ms | 99,329 ms |
| `GET /validar-sesion` | 16.330 | 0 | 16.330 | 2,476 ms | 3,864 ms | 4,549 ms | 50,575 ms |
| `POST /ds160/load` | 16.330 | 0 | 16.330 | 2,832 ms | 4,336 ms | 5,187 ms | 89,142 ms |
| `POST /documentos/listar` | 16.330 | 0 | 16.330 | 2,921 ms | 4,408 ms | 5,275 ms | 61,262 ms |

### Monitoreo y logs

Se tomaron 22 muestras, aproximadamente cada 36 s, en `tests/results/scrum-204-monitor.log`. Valores máximos observados por contenedor:

| Servicio | CPU máxima observada | Memoria máxima observada | Estado y reinicios |
| --- | ---: | ---: | --- |
| Backend | 16,19 % | 85,84 MiB | Activo; 0 reinicios |
| Frontend/Nginx | 5,27 % | 6,516 MiB | Activo; 0 reinicios |
| PostgreSQL | 9,11 % | 52,36 MiB | Saludable; 0 reinicios |

Las muestras puntuales pueden omitir picos entre intervalos. En el período de full, el backend no emitió líneas nuevas de log; Nginx registró 49.190 solicitudes y ninguna respuesta HTTP 4xx/5xx; PostgreSQL emitió 2 líneas sin patrones de error, fatalidad, timeout ni saturación de conexiones. Tampoco se detectaron esos patrones en los logs de backend o frontend. El progreso de k6 registró cero iteraciones interrumpidas. No se midieron directamente conexiones SQL, planes de consulta, utilización del host ni saturación del generador.

## Comparación con RNF-9 y cuellos de botella

En el entorno Docker local probado, RNF-9 se cumplió bajo los criterios operativos acordados: se alcanzaron 200 VUs y se sostuvieron unos cinco minutos sin indisponibilidad, fallos HTTP ni degradación crítica observable en la latencia global. Esta conclusión se limita al flujo y entorno medidos; no certifica la capacidad de AWS o producción ni la experiencia con 200 cuentas distintas.

No se identificó un cuello de botella demostrado por estas mediciones. El login fue el endpoint más lento (p95 56,076 ms), pero sus 200 solicitudes ocurrieron una vez por VU y no presentó fallos. Los porcentajes de CPU y la memoria observados fueron bajos respecto de los recursos asignados; no hay evidencia de saturación de backend, Nginx o PostgreSQL durante esta prueba.

## Limitaciones y recomendaciones

- Una sola cuenta reutilizada por 200 VUs puede favorecer cachés y rutas de datos iguales, y reduce la representatividad de 200 usuarios distintos.
- k6 y Docker corrieron en el mismo equipo; no se aisló la capacidad del generador ni se midió el consumo del host.
- El flujo cubre login y tres lecturas autenticadas; no mide escrituras, subida de archivos, correo ni otros recorridos de producto. Los 200 logins pueden dejar registros de actividad.
- La definición de «degradación crítica» de RNF-9 es cualitativa; los límites numéricos usados son criterios operativos de esta prueba.
- Para una validación más representativa, repetir en un entorno controlado con 200 cuentas distintas y monitoreo del host, conexiones y consultas de PostgreSQL. Cualquier carga en un entorno remoto requiere autorización humana explícita; este resultado local no autoriza una ejecución remota.

Fuentes locales reproducibles, sin versionar: `tests/results/scrum-204-smoke-summary.json`, `tests/results/scrum-204-full-summary.json`, `tests/results/scrum-204-k6.log` y `tests/results/scrum-204-monitor.log`.
