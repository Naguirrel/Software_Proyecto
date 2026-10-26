BEGIN;

-- Fecha y versión del aviso de privacidad que la persona aceptó al registrarse (SP10-12).
-- Las cuentas anteriores a este cambio quedan en NULL: no tienen consentimiento registrado.
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS privacidad_aceptada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacidad_version VARCHAR(20);

COMMIT;
