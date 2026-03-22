
INSERT INTO storage.buckets (id, name, "public") VALUES ('garment-images', 'garment-images', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Authenticated users can upload garment images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'garment-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view garment images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'garment-images');
CREATE POLICY "Users can delete own garment images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'garment-images' AND (storage.foldername(name))[1] = auth.uid()::text);
