ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS avatar_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS avatar_mime_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS advisor_change_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  current_advisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
  category VARCHAR(40) NOT NULL CHECK (category IN (
    'mistreatment', 'poor_communication', 'lack_of_follow_up', 'conflict', 'other'
  )),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 20 AND 2000),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  resolution TEXT,
  reviewed_by INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  new_advisor_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS advisor_change_requests_one_pending_idx
  ON advisor_change_requests(user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS advisor_change_requests_admin_queue_idx
  ON advisor_change_requests(status, created_at, id);
