-- SP10-11: indices para las busquedas por usuario que hacian Seq Scan
-- en la prueba de volumen (tests/volumen/indices-propuestos.sql).
BEGIN;

CREATE INDEX IF NOT EXISTS formulario_ds160_usuario_idx
ON formulario_ds160(id_usuario);

-- Cubre WHERE usuario_id = $1 ORDER BY actualizado_en DESC, creado_en DESC
CREATE INDEX IF NOT EXISTS documentos_usuario_actualizado_idx
ON documentos(usuario_id, actualizado_en DESC, creado_en DESC);

COMMIT;

ANALYZE formulario_ds160;
ANALYZE documentos;
