BEGIN;

ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS ejemplo_fuerte TEXT,
  ADD COLUMN IF NOT EXISTS explicacion_fuerte TEXT,
  ADD COLUMN IF NOT EXISTS ejemplo_debil TEXT,
  ADD COLUMN IF NOT EXISTS explicacion_debil TEXT;

DO $$
DECLARE
  field_name TEXT;
  constraint_name TEXT;
BEGIN
  FOREACH field_name IN ARRAY ARRAY['ejemplo_fuerte', 'explicacion_fuerte', 'ejemplo_debil', 'explicacion_debil']
  LOOP
    constraint_name := 'question_bank_' || field_name || '_length';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = constraint_name
        AND conrelid = 'question_bank'::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE question_bank ADD CONSTRAINT %I CHECK (char_length(%I) <= 2000)',
        constraint_name,
        field_name
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
