# npm audit - Sprint 9 (SCRUM-218)

Estado inicial (13/10/2026): backend 14 vulnerabilidades (1 crítica, 6 altas, 6 moderadas, 1 baja) y frontend 15 (9 altas, 5 moderadas, 1 baja).
Estado final: `npm audit` reporta **0 vulnerabilidades** en backend y frontend.

## Backend
| Paquete | Severidad inicial | Resolución |
|---|---|---|
| proxy-addr (vía express) | crítica | `npm audit fix` (actualiza dependencias transitivas dentro del rango semver) |
| multer (directa), path-to-regexp, brace-expansion, browserslist, fast-xml-builder, js-yaml | altas | `npm audit fix` |
| qs, body-parser, baseline-browser-mapping, argparse, sprintf-js | moderadas/baja | `npm audit fix` y override de `argparse` (ver abajo) |
| uuid (vía exceljs) | moderada | override `uuid: ^11.1.1` |

`npm audit fix --force` proponía `exceljs@3.4.0` y `jest@25`, que son **bajadas de versión** mayores; no se aplicaron.

### Overrides en `backend/package.json`
- `uuid ^11.1.1`: `exceljs@4.4.0` depende de `uuid@8`, afectado por un chequeo de límites faltante en v3/v5/v6. `exceljs` solo usa v4, y la versión 11 mantiene soporte CommonJS. Verificado con las pruebas de reportes Excel y generando un libro real.
- `argparse ^2.0.1`: `sprintf-js` (DoS por precisiones sin límite) no tiene versión corregida publicada. Llegaba solo por `jest` → `babel-plugin-istanbul` → `js-yaml@3` → `argparse@1`. `js-yaml@3` usa `argparse` únicamente en su CLI, no en la librería, que es lo que usa la herramienta de cobertura. Verificado con `jest --coverage`.

## Frontend
- `vite`, `react-router`/`react-router-dom`, `postcss`, `nanoid`, `source-map-js`, `brace-expansion`, `browserslist`, `js-yaml`: `npm audit fix`.
- `vitest` y `@vitest/coverage-v8` subidos a `^4.1.11` (lectura arbitraria de archivos vía `@vitest/mocker`, corregida en 4.1.11). Se mantiene la rama 4.x.

## Verificación
- Backend: 34 suites, 521 pruebas pasan; `npm ci --dry-run` correcto.
- Frontend: 30 suites, 194 pruebas pasan; `npm run build` y `npm run lint` sin errores; `npm ci --dry-run` correcto.
