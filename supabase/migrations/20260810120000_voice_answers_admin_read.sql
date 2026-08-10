-- Allow global admins to SELECT voice_answers from the browser.
-- Writes still go through the voice-upload edge function (service_role).
-- Clients (portal users) remain blocked — only global_admin role can read.

drop policy if exists voice_answers_admin_read on public.voice_answers;
create policy voice_answers_admin_read on public.voice_answers
  for select
  to authenticated
  using (public.is_global_admin());

grant select on public.voice_answers to authenticated;
