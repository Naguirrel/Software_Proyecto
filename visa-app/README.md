# VisaGuide

[![CI](https://github.com/dquan123/Software_Proyecto/actions/workflows/ci.yml/badge.svg)](https://github.com/dquan123/Software_Proyecto/actions/workflows/ci.yml)

Aplicación web para gestionar procesos de visa estadounidense.

## Requisitos

- Docker y Docker Compose, o Node.js 20 y PostgreSQL 15.

## Ejecución con Docker

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Configure `SESSION_SECRET` con un valor unico y aleatorio en `.env` antes de iniciar. El archivo `docker-compose.dev.yml` activa `NODE_ENV=development` solo cuando se incluye explicitamente. Para produccion, desde `visa-app/` y con la configuracion real protegida, use:

```bash
docker compose -f docker-compose.yml up -d --build
```

Consulte la [guia de infraestructura](docs/infraestructura.md) para arquitectura, variables, despliegue, backup y restauracion.

- Frontend: `http://localhost:8080`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`

## Ejecución local

```bash
cd backend
npm ci
npm start
```

```bash
cd frontend
npm ci
npm run dev
```

Configura las variables de `.env.example`. Las obligatorias son la conexión PostgreSQL (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) y `SESSION_SECRET`.

### Actualizaciones de base de datos

`init.sql` prepara instalaciones nuevas. Para una base existente, aplica las migraciones pendientes antes de desplegar el backend:

```bash
docker compose -f docker-compose.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/migrations/001_advisor_communication.sql
docker compose -f docker-compose.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/migrations/002_user_lookup_indexes.sql
```

## Autenticación

`POST /login` devuelve el token de sesión. Los endpoints protegidos reciben:

```http
Authorization: Bearer <token>
```

Roles disponibles: `cliente`, `asesor` y `admin`.

En desarrollo, el backend crea cuentas de prueba con contraseñas distintas y
almacenadas como hashes bcrypt. Las credenciales locales están en `Claves.txt`
en la raíz de `visa-app`; ese archivo está excluido de Git y debe mantenerse
privado. Al iniciar, las cuentas de prueba existentes que aún tengan una de las
contraseñas predeterminadas anteriores se actualizan. Las contraseñas cambiadas
manualmente se respetan. No existe el rol `superadmin` en el esquema actual.

## API

La documentación interactiva está en `/api-docs` y el contrato OpenAPI en `/api-docs.json`.

## Pruebas

```bash
cd backend && npm test
cd frontend && npm test -- --run
```
