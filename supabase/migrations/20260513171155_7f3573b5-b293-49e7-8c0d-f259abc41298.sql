
CREATE TABLE public.client_progress (
  client_code TEXT PRIMARY KEY,
  welcome_form_submitted BOOLEAN NOT NULL DEFAULT false,
  founder_scan_submitted BOOLEAN NOT NULL DEFAULT false,
  video_watched BOOLEAN NOT NULL DEFAULT false,
  paid BOOLEAN NOT NULL DEFAULT false,
  contract_signed BOOLEAN NOT NULL DEFAULT false,
  kickoff_scheduled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read client_progress"
  ON public.client_progress FOR SELECT
  USING (true);

CREATE POLICY "Public insert client_progress"
  ON public.client_progress FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update client_progress"
  ON public.client_progress FOR UPDATE
  USING (true) WITH CHECK (true);
