-- Mitigación propuesta tras la prueba de volumen: índices para las búsquedas por usuario
-- que hoy recorren la tabla completa (Seq Scan). Se aplica solo en visa_volumen para medir el efecto.
\set ON_ERROR_STOP on
SELECT current_database() = 'visa_volumen' AS base_aislada \gset
\if :base_aislada
\else
  \echo 'Abortado: este script solo debe ejecutarse sobre la base visa_volumen.'
  \quit
\endif

CREATE INDEX IF NOT EXISTS formulario_ds160_usuario_idx ON formulario_ds160(id_usuario);
CREATE INDEX IF NOT EXISTS documentos_usuario_actualizado_idx ON documentos(usuario_id, actualizado_en DESC, creado_en DESC);
ANALYZE formulario_ds160;
ANALYZE documentos;
