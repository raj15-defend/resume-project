-- Create profiles table for additional user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_keys table for encrypted private keys and public keys
CREATE TABLE IF NOT EXISTS public.user_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  key_algorithm TEXT NOT NULL DEFAULT 'RSA-OAEP',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create encrypted_files table for storing encrypted file metadata
CREATE TABLE IF NOT EXISTS public.encrypted_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  encrypted_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  encrypted_symmetric_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create file_shares table for sharing encrypted files
CREATE TABLE IF NOT EXISTS public.file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.encrypted_files(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  encrypted_symmetric_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_shares ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- User keys policies
CREATE POLICY "Users can view their own keys"
  ON public.user_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own keys"
  ON public.user_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own keys"
  ON public.user_keys FOR UPDATE
  USING (auth.uid() = user_id);

-- Encrypted files policies
CREATE POLICY "Users can view their own files"
  ON public.encrypted_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
  ON public.encrypted_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files"
  ON public.encrypted_files FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
  ON public.encrypted_files FOR DELETE
  USING (auth.uid() = user_id);

-- File shares policies
CREATE POLICY "Users can view shares for their files"
  ON public.file_shares FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = recipient_id);

CREATE POLICY "Owners can create shares"
  ON public.file_shares FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete shares"
  ON public.file_shares FOR DELETE
  USING (auth.uid() = owner_id);

-- Create storage bucket for encrypted files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('encrypted-files', 'encrypted-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for encrypted files bucket
CREATE POLICY "Users can upload their own encrypted files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'encrypted-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own encrypted files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'encrypted-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own encrypted files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'encrypted-files' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_keys_updated_at
  BEFORE UPDATE ON public.user_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_encrypted_files_updated_at
  BEFORE UPDATE ON public.encrypted_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_keys_user_id ON public.user_keys(user_id);
CREATE INDEX idx_encrypted_files_user_id ON public.encrypted_files(user_id);
CREATE INDEX idx_file_shares_file_id ON public.file_shares(file_id);
CREATE INDEX idx_file_shares_recipient_id ON public.file_shares(recipient_id);