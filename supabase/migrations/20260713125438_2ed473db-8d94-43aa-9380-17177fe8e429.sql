CREATE TABLE public.gos_client_workflow_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gos_clients(id) ON DELETE CASCADE,
  block_key text NOT NULL CHECK (block_key IN ('setup','diagnosis','planning','execution','live','learning')),
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED','READY')),
  completed_at timestamptz,
  completed_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, block_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gos_client_workflow_statuses TO anon, authenticated;
GRANT ALL ON public.gos_client_workflow_statuses TO service_role;

ALTER TABLE public.gos_client_workflow_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gos_client_workflow_statuses_all"
ON public.gos_client_workflow_statuses
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER trg_gos_client_workflow_statuses_updated
BEFORE UPDATE ON public.gos_client_workflow_statuses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gos_client_workflow_statuses_client
ON public.gos_client_workflow_statuses(client_id, block_key);