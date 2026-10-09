# VisaGuide

[![CI](https://github.com/dquan123/Software_Proyecto/actions/workflows/ci.yml/badge.svg)](https://github.com/dquan123/Software_Proyecto/actions/workflows/ci.yml)

Aplicación web para gestionar procesos de visa estadounidense.

## Requisitos

- Docker y Docker Compose, o Node.js 20 y PostgreSQL 15.

## Ejecución con Docker

```bash
cp .env.example .env
docker compose up --build
```

Este comando carga automaticamente `docker-compose.override.yml` y ejecuta el backend en modo desarrollo. Para produccion, desde `visa-app/` y con la configuracion real protegida, use explicitamente:

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
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backend/migrations/001_advisor_communication.sql
```

## Autenticación

`POST /login` devuelve el token de sesión. Los endpoints protegidos reciben:

```http
Authorization: Bearer <token>
```

Roles disponibles: `cliente`, `asesor` y `admin`.

## API

La documentación interactiva está en `/api-docs` y el contrato OpenAPI en `/api-docs.json`.

## Pruebas

```bash
cd backend && npm test
cd frontend && npm test -- --run
```
