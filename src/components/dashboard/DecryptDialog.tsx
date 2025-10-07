import { useState } from 'react';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DecryptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecrypt: (passphrase: string) => Promise<void>;
  filename: string;
}

export function DecryptDialog({ open, onOpenChange, onDecrypt, filename }: DecryptDialogProps) {
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDecrypt = async () => {
    if (!passphrase) {
      setError('Please enter your passphrase');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onDecrypt(passphrase);
      onOpenChange(false);
      setPassphrase('');
    } catch (err: any) {
      setError(err.message || 'Decryption failed. Please check your passphrase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
              <Unlock className="w-5 h-5 text-primary-foreground" />
            </div>
            Decrypt File
          </DialogTitle>
          <DialogDescription>
            Enter your passphrase to decrypt <strong>{filename}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-muted/50 border-border">
            <Lock className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              Your passphrase is used to decrypt your private key, which then decrypts the file.
              This happens entirely in your browser.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="passphrase">Passphrase</Label>
            <Input
              id="passphrase"
              type="password"
              placeholder="Enter your passphrase"
              value={passphrase}
              onChange={(e) => {
                setPassphrase(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  handleDecrypt();
                }
              }}
              disabled={loading}
              className="bg-background border-border"
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive" className="border-destructive/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setPassphrase('');
              setError('');
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDecrypt}
            disabled={loading || !passphrase}
            className="bg-gradient-primary hover:shadow-glow transition-all"
          >
            {loading ? (
              <>
                <Unlock className="w-4 h-4 mr-2 animate-pulse" />
                Decrypting...
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 mr-2" />
                Decrypt & Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
