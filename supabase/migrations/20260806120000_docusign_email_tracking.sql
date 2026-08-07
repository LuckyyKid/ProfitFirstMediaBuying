-- Track envelopes sent via send-docusign-contract-email (admin-triggered
-- email delivery from admin/contract-creator). Kept separate from the
-- embedded Step 7 columns (docusign_envelope_id / docusign_sent_at) so the
-- two flows never overwrite each other.
alter table public.client_progress
  add column if not exists docusign_email_envelope_id text,
  add column if not exists docusign_email_sent_at timestamptz,
  add column if not exists docusign_email_sent_to text;
