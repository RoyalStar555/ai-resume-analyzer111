CREATE POLICY "Users can upload resumes to their private ingestion folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'enterprise_ingestion_vault'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "Users can read resumes from their private ingestion folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'enterprise_ingestion_vault'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);