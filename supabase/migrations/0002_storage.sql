-- Create a public bucket for report photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage
-- Allow anyone to read files from this public bucket
CREATE POLICY "Anyone can view report photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'report-photos');

-- Allow authenticated users to upload files to this bucket
CREATE POLICY "Authenticated users can upload report photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-photos' AND auth.role() = 'authenticated');

-- Allow users to delete their own uploaded photos
CREATE POLICY "Users can delete their own report photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
