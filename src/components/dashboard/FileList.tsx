import { useState, useEffect } from 'react';
import { File, Download, Trash2, Lock, Unlock, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  unwrapSymmetricKey, 
  decryptFile, 
  decryptPrivateKey,
  base64ToArrayBuffer 
} from '@/lib/encryption';
import { formatBytes } from '@/lib/utils';
import { DecryptDialog } from './DecryptDialog';

interface EncryptedFile {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  encrypted_symmetric_key: string;
  iv: string;
  storage_path: string;
  created_at: string;
}

export function FileList({ refreshTrigger }: { refreshTrigger: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState<string | null>(null);
  const [decryptDialogOpen, setDecryptDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<EncryptedFile | null>(null);

  useEffect(() => {
    loadFiles();
  }, [user, refreshTrigger]);

  const loadFiles = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('encrypted_files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      toast({
        title: 'Failed to load files',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadClick = (file: EncryptedFile) => {
    setSelectedFile(file);
    setDecryptDialogOpen(true);
  };

  const handleDecrypt = async (passphrase: string) => {
    if (!user || !selectedFile) return;

    setDecrypting(selectedFile.id);
    try {
      // Get user's encrypted private key
      const { data: keyData, error: keyError } = await supabase
        .from('user_keys')
        .select('encrypted_private_key')
        .eq('user_id', user.id)
        .maybeSingle();

      if (keyError) throw keyError;
      if (!keyData) {
        throw new Error('Encryption keys not found. Please set up your keys first.');
      }

      // Parse encrypted private key data
      const { encryptedKey, salt, iv } = JSON.parse(keyData.encrypted_private_key);

      // Decrypt private key using passphrase
      const privateKey = await decryptPrivateKey(encryptedKey, salt, iv, passphrase);

      // Download encrypted file from storage
      const { data: encryptedBlob, error: downloadError } = await supabase.storage
        .from('encrypted-files')
        .download(selectedFile.storage_path);

      if (downloadError) throw downloadError;

      // Unwrap the symmetric key using private key
      const symmetricKey = await unwrapSymmetricKey(
        selectedFile.encrypted_symmetric_key,
        privateKey
      );

      // Decrypt the file using symmetric key
      const decryptedBlob = await decryptFile(
        encryptedBlob,
        symmetricKey,
        selectedFile.iv
      );

      // Create download link with decrypted file
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'File decrypted and downloaded',
        description: `${selectedFile.filename} has been successfully decrypted.`,
      });
    } catch (error: any) {
      console.error('Decryption error:', error);
      
      // Provide specific error messages
      if (error.message.includes('OperationError') || error.message.includes('decrypt')) {
        throw new Error('Invalid passphrase. Please try again.');
      }
      throw error;
    } finally {
      setDecrypting(null);
    }
  };

  const handleDelete = async (file: EncryptedFile) => {
    if (!confirm(`Delete ${file.filename}? This cannot be undone.`)) return;

    try {
      // Delete from storage
      await supabase.storage.from('encrypted-files').remove([file.storage_path]);

      // Delete from database
      const { error } = await supabase
        .from('encrypted_files')
        .delete()
        .eq('id', file.id);

      if (error) throw error;

      setFiles((prev) => prev.filter((f) => f.id !== file.id));

      toast({
        title: 'File deleted',
        description: `${file.filename} has been permanently deleted.`,
      });
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card className="p-8 text-center bg-card/50">
        <p className="text-muted-foreground">Loading encrypted files...</p>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card className="p-8 text-center bg-card/50 border-border/50">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No files yet</h3>
        <p className="text-muted-foreground">
          Upload your first file to get started with secure storage
        </p>
      </Card>
    );
  }

  return (
    <>
      <DecryptDialog
        open={decryptDialogOpen}
        onOpenChange={setDecryptDialogOpen}
        onDecrypt={handleDecrypt}
        filename={selectedFile?.filename || ''}
      />
      
      <div className="space-y-3">
        {files.map((file) => (
        <Card
          key={file.id}
          className="p-4 bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-glow">
              <File className="w-6 h-6 text-primary-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate flex items-center gap-2">
                {file.filename}
                <Badge variant="secondary" className="text-xs">
                  <Lock className="w-3 h-3 mr-1" />
                  Encrypted
                </Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                {formatBytes(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownloadClick(file)}
                disabled={decrypting === file.id}
                className="hover:bg-accent/10 hover:text-accent"
                title="Decrypt and download"
              >
                {decrypting === file.id ? (
                  <Unlock className="w-4 h-4 animate-pulse" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(file)}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
        ))}
      </div>
    </>
  );
}
