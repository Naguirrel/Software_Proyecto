# Pruebas no funcionales

Scripts de carga, seguridad y volumen de VisaGuide. No forman parte de CI y se ejecutan a mano desde `visa-app/`. Las pruebas unitarias y de integración viven en `backend/` y `frontend/`, y las E2E en `e2e/`.

Todas están pensadas para la **app local en Docker** (`http://localhost:8080/api`). No las ejecute contra producción: generan carga real, bloquean cuentas y pueden enviar correos.

| Archivo | Tipo | Herramienta |
|---|---|---|
| `load-test.js` | Carga, inundación y estrés | k6 |
| `load-test-utils.js` | Funciones compartidas por los scripts de k6 | — |
| `load-test-utils.test.js` | Pruebas de esas funciones | `node --test` |
| `users.example.json` | Plantilla de cuentas para la carga | — |
| `seguridad/fuerza-bruta.js` | Fuerza bruta concurrente contra una cuenta (RNF-13) | k6 |
| `volumen/poblar.sql` | Carga 2,6 millones de filas en una base aislada | psql |
| `volumen/consultas-app.sql` | Consultas del backend para medir la base | pgbench |
| `volumen/indices-propuestos.sql` | Índices que se midieron en la prueba de volumen | psql |
| `results/` | Resúmenes JSON que genera k6 (ignorados por git) | — |

## Cuentas de prueba

Copie la plantilla a `tests/users.local.json`, que está en `.gitignore`, y complete cuentas **de prueba** de la app local:

```bash
cp tests/users.example.json tests/users.local.json
```

No guarde las cuentas en otra ruta: solo `tests/users.local.json` está excluida de git.

## Carga (`load-test.js`)

Cada usuario virtual inicia sesión y repite `GET /validar-sesion`, `POST /ds160/load` y `POST /documentos/listar`. El perfil se elige con `TEST_PROFILE`:

| Perfil | Usuarios virtuales | Uso |
|---|---|---|
| `smoke` | 1 | Comprobar que el script y la app funcionan |
| `full` | 200 | RNF-9: 200 usuarios concurrentes |
| `spike` | 500 | Inundación repentina |
| `stress` | hasta 1000, por escalones | Buscar el límite del sistema |

```bash
k6 run -e TEST_PROFILE=smoke -e USERS_FILE=./tests/users.local.json tests/load-test.js
```

Con una sola cuenta se puede usar `-e TEST_EMAIL=... -e TEST_PASSWORD=...` en lugar de `USERS_FILE`. El resumen queda en `tests/results/`. El script rechaza URLs remotas salvo que se defina `ALLOW_REMOTE_LOAD_TEST=true`. Los resultados de referencia están en `docs/resultados-carga-scrum-204.md`.

Las funciones de apoyo tienen pruebas propias:

```bash
node --test tests/load-test-utils.test.js
```

## Fuerza bruta (`seguridad/fuerza-bruta.js`)

20 atacantes concurrentes prueban 10 contraseñas cada uno contra una sola cuenta y, al final, la contraseña correcta. Sirve para comprobar el bloqueo tras 5 intentos (RNF-13) y el rate limiting del login.

```bash
k6 run -e TARGET_EMAIL=... -e TARGET_PASSWORD=... tests/seguridad/fuerza-bruta.js
```

Use una cuenta de prueba: queda bloqueada 15 minutos. Se ajusta con `ATTACKERS` y `ATTEMPTS`. El resultado esperado es 0 accesos concedidos. Las respuestas 401 son contraseñas rechazadas, las 423 indican cuenta bloqueada y las 429 el rate limiting; el script cuenta las 429 como "inesperadas" porque es anterior al rate limiting.

## Volumen (`volumen/`)

Los scripts trabajan sobre una base **aislada** llamada `visa_volumen`, creada con `init.sql`. `poblar.sql` y `indices-propuestos.sql` se niegan a ejecutarse sobre otra base.

```bash
psql -d visa_volumen -f tests/volumen/poblar.sql
pgbench -n -r -f tests/volumen/consultas-app.sql -c 50 -j 4 -T 30 visa_volumen
```

Los índices de `indices-propuestos.sql` ya están en `init.sql` y en la migración `backend/migrations/002_user_lookup_indexes.sql`; el archivo se conserva para repetir la medición del antes y el después.
