-- Prueba de volumen de PostgreSQL (Sprint 9).
-- Puebla una base AISLADA (visa_volumen) creada con init.sql; nunca ejecutar sobre visa_db.
-- Volumen: 100.000 usuarios con su trámite, DS-160, 4 documentos, 10 notificaciones
-- y 10 intentos de login cada uno (≈ 2,6 millones de filas en total).

\set ON_ERROR_STOP on
SELECT current_database() = 'visa_volumen' AS base_aislada \gset
\if :base_aislada
\else
  \echo 'Abortado: este script solo debe ejecutarse sobre la base visa_volumen.'
  \quit
\endif

INSERT INTO usuario (nombre, correo, contrasena, perfil, rol, email_verificado)
SELECT 'Usuario ' || g,
       'volumen' || g || '@visaguide.test',
       '$2b$10$abcdefghijklmnopqrstuuJ0pTzNx1bq0n6nP7S0e0y5wXyZ1a2b',
       (ARRAY['turismo_negocios', 'estudiante', 'renovacion'])[1 + g % 3],
       'cliente',
       TRUE
FROM generate_series(1, 100000) AS g;

INSERT INTO tramite (id_usuario, estado, etapa_actual, progreso)
SELECT id_usuario, 'En proceso', 'Formulario DS-160', 17 FROM usuario;

INSERT INTO formulario_ds160 (id_usuario, datos, seccion_actual, completado)
SELECT id_usuario,
       jsonb_build_object('nombre', nombre, 'pasaporte', 'P' || id_usuario, 'ciudad', 'Guatemala',
                          'motivo', repeat('Turismo y visita familiar. ', 20)),
       1 + id_usuario % 10,
       id_usuario % 10 = 0
FROM usuario;

INSERT INTO documentos (nombre, tipo, archivo_url, documento_key, estado, usuario_id, storage_key)
SELECT 'documento-' || k || '.pdf', 'application/pdf',
       '/documentos/' || u.id_usuario || '-' || k || '/archivo',
       (ARRAY['passport', 'photo', 'intake-form', 'bank-statement'])[k],
       (ARRAY['review', 'approved', 'correction'])[1 + (u.id_usuario + k) % 3],
       u.id_usuario,
       'documentos/' || u.id_usuario || '/' || k
FROM usuario u CROSS JOIN generate_series(1, 4) AS k;

INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, leido, created_at)
SELECT u.id_usuario, 'Notificación ' || n, 'Mensaje de prueba de volumen número ' || n,
       'info', n % 3 = 0, NOW() - (n || ' hours')::interval
FROM usuario u CROSS JOIN generate_series(1, 10) AS n;

INSERT INTO login_attempts (id_usuario, correo, ip, created_at)
SELECT u.id_usuario, u.correo, '10.0.0.' || (n % 250), NOW() - (n || ' days')::interval
FROM usuario u CROSS JOIN generate_series(1, 10) AS n;

ANALYZE;

SELECT 'usuario' AS tabla, COUNT(*) FROM usuario
UNION ALL SELECT 'tramite', COUNT(*) FROM tramite
UNION ALL SELECT 'formulario_ds160', COUNT(*) FROM formulario_ds160
UNION ALL SELECT 'documentos', COUNT(*) FROM documentos
UNION ALL SELECT 'notificaciones', COUNT(*) FROM notificaciones
UNION ALL SELECT 'login_attempts', COUNT(*) FROM login_attempts;
