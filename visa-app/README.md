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
