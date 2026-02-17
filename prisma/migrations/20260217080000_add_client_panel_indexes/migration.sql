-- Improves cursor and recent-first queries used by client detail panels.
CREATE INDEX IF NOT EXISTS contacts_client_id_created_at_idx
  ON contacts ("client_id", "created_at");

CREATE INDEX IF NOT EXISTS systems_client_id_updated_at_idx
  ON systems ("client_id", "updated_at");

CREATE INDEX IF NOT EXISTS engagements_client_id_updated_at_idx
  ON engagements ("client_id", "updated_at");
