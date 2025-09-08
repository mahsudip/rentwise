-- Storage bucket policies for documents
-- These policies need to be applied to the 'documents' storage bucket

-- Policy for uploading files (INSERT)
CREATE POLICY "Users can upload documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for viewing files (SELECT)
CREATE POLICY "Users can view their documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for updating files (UPDATE)
CREATE POLICY "Users can update their documents" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for deleting files (DELETE)
CREATE POLICY "Users can delete their documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
