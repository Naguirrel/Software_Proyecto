BEGIN;

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notificaciones_prioridad_check'
      AND conrelid = 'notificaciones'::regclass
  ) THEN
    ALTER TABLE notificaciones
      ADD CONSTRAINT notificaciones_prioridad_check CHECK (prioridad IN ('baja', 'normal', 'alta'));
  END IF;
END $$;

COMMIT;
