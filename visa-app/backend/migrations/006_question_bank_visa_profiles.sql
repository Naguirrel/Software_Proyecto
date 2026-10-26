ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS visa_profiles TEXT[] NOT NULL
  DEFAULT ARRAY['turismo_negocios','estudiante','renovacion','grupo_familiar','adulto_mayor']::text[];

CREATE INDEX IF NOT EXISTS question_bank_visa_profiles_idx
  ON question_bank USING GIN (visa_profiles);
