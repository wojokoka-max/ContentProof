CREATE TABLE IF NOT EXISTS analysis_history (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  analysis_id text NOT NULL,
  title text NOT NULL,
  input_mode text NOT NULL CHECK (input_mode IN ('text', 'html', 'url')),
  source_label text,
  input_content text NOT NULL,
  result_json jsonb NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS analysis_history_owner_updated_idx
  ON analysis_history (owner_id, updated_at DESC);

