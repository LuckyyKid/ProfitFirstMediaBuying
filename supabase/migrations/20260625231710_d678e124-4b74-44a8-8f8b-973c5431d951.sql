CREATE POLICY "Public delete client_progress" ON public.client_progress FOR DELETE USING (true);
CREATE POLICY "Public delete client_form_answers" ON public.client_form_answers FOR DELETE USING (true);
CREATE POLICY "Public delete client_platform_access" ON public.client_platform_access FOR DELETE USING (true);
CREATE POLICY "Public delete client_activity_log" ON public.client_activity_log FOR DELETE USING (true);