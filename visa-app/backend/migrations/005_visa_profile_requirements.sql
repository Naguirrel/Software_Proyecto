ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS visa_details JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS family_group_members (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  full_name VARCHAR(160) NOT NULL,
  relationship VARCHAR(40) NOT NULL,
  date_of_birth DATE NOT NULL,
  ds160_confirmation_number VARCHAR(30),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT family_group_members_relationship_check
    CHECK (relationship IN ('conyuge','hijo_hija','padre_madre','hermano_hermana','otro'))
);

CREATE INDEX IF NOT EXISTS family_group_members_user_idx
  ON family_group_members(user_id, created_at, id);
