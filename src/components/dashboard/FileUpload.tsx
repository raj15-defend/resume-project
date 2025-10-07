import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  generateFileEncryptionKey,
  encryptFile,
  wrapSymmetricKey,
  calculateFileChecksum,
  exportPublicKey,
} from '@/lib/encryption';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'encrypting' | 'uploading' | 'complete' | 'error';
  error?: string;
}

export function FileUpload({ onUploadComplete }: { onUploadComplete: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const processFile = async (file: File) => {
    if (!user) return;

    const uploadId = file.name + Date.now();
    setUploads((prev) => [
      ...prev,
      { file, progress: 0, status: 'encrypting' },
    ]);

    try {
      // Get user's public key
      const { data: keyData } = await supabase
        .from('user_keys')
        .select('public_key')
        .eq('user_id', user.id)
        .single();

      if (!keyData) {
        throw new Error('User keys not found. Please set up encryption keys first.');
      }

      // Generate symmetric key for file
      const symmetricKey = await generateFileEncryptionKey();

      // Encrypt file
      setUploads((prev) =>
        prev.map((u) =>
          u.file === file ? { ...u, progress: 20, status: 'encrypting' } : u
        )
      );

      const { encrypted, iv } = await encryptFile(file, symmetricKey);

      // Calculate checksum
      const checksum = await calculateFileChecksum(file);

      // Wrap symmetric key with user's public key
      const publicKeyObj = await crypto.subtle.importKey(
        'spki',
        Uint8Array.from(atob(keyData.public_key), (c) => c.charCodeAt(0)),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['wrapKey']
      );

      const wrappedKey = await wrapSymmetricKey(symmetricKey, publicKeyObj);

      setUploads((prev) =>
        prev.map((u) =>
          u.file === file ? { ...u, progress: 50, status: 'uploading' } : u
        )
      );

      // Upload encrypted file to storage
      const storagePath = `${user.id}/${uploadId}`;
      const { error: storageError } = await supabase.storage
        .from('encrypted-files')
        .upload(storagePath, encrypted);

      if (storageError) throw storageError;

      setUploads((prev) =>
        prev.map((u) =>
          u.file === file ? { ...u, progress: 80 } : u
        )
      );

      // Store metadata in database
      const { error: dbError } = await supabase.from('encrypted_files').insert({
        user_id: user.id,
        filename: file.name,
        encrypted_filename: uploadId,
        file_size: file.size,
        mime_type: file.type,
        encrypted_symmetric_key: wrappedKey,
        iv: iv,
        storage_path: storagePath,
        checksum: checksum,
      });

      if (dbError) throw dbError;

      setUploads((prev) =>
        prev.map((u) =>
          u.file === file ? { ...u, progress: 100, status: 'complete' } : u
        )
      );

      toast({
        title: 'File encrypted and uploaded',
        description: `${file.name} is now securely stored.`,
      });

      onUploadComplete();
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploads((prev) =>
        prev.map((u) =>
          u.file === file ? { ...u, status: 'error', error: error.message } : u
        )
      );

      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => processFile(file));
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <Card
        {...getRootProps()}
        className={`border-2 border-dashed transition-all cursor-pointer ${
          isDragActive
            ? 'border-primary bg-gradient-glass shadow-glow'
            : 'border-border hover:border-primary/50 bg-card/50'
        }`}
      >
        <div className="p-12 text-center">
          <input {...getInputProps()} />
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mb-4 shadow-glow">
            <Upload className="w-8 h-8 text-primary-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            {isDragActive ? 'Drop files here' : 'Upload files'}
          </h3>
          <p className="text-muted-foreground mb-4">
            Drag & drop files or click to browse
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-accent">
            <Lock className="w-4 h-4" />
            <span>Files are encrypted client-side before upload</span>
          </div>
        </div>
      </Card>

      {uploads.length > 0 && (
        <div className="space-y-3">
          {uploads.map((upload, idx) => (
            <Card key={idx} className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
              <div className="flex items-center gap-3 mb-2">
                {upload.status === 'complete' ? (
                  <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                ) : upload.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                ) : (
                  <Lock className="w-5 h-5 text-primary animate-pulse flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{upload.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {upload.status === 'complete'
                      ? 'Encrypted and uploaded'
                      : upload.status === 'error'
                      ? upload.error
                      : upload.status === 'encrypting'
                      ? 'Encrypting...'
                      : 'Uploading...'}
                  </p>
                </div>
              </div>
              {upload.status !== 'complete' && upload.status !== 'error' && (
                <Progress value={upload.progress} className="h-2" />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
