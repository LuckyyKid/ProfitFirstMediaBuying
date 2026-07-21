
CREATE POLICY "Open read closed-deals-contracts" ON storage.objects
  FOR SELECT USING (bucket_id = 'closed-deals-contracts');
CREATE POLICY "Open insert closed-deals-contracts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'closed-deals-contracts');
CREATE POLICY "Open update closed-deals-contracts" ON storage.objects
  FOR UPDATE USING (bucket_id = 'closed-deals-contracts');
CREATE POLICY "Open delete closed-deals-contracts" ON storage.objects
  FOR DELETE USING (bucket_id = 'closed-deals-contracts');
