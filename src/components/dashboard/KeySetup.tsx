import { useState } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  generateUserKeypair,
  exportPublicKey,
  exportPrivateKey,
  encryptPrivateKey,
  generateSecurePassphrase,
} from '@/lib/encryption';

export function KeySetup({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGeneratePassphrase = () => {
    const generated = generateSecurePassphrase(6);
    setPassphrase(generated);
    setConfirmPassphrase('');
    toast({
      title: 'Passphrase generated',
      description: 'Please save this passphrase securely. You\'ll need it to access your files.',
    });
  };

  const handleSetupKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (passphrase !== confirmPassphrase) {
      toast({
        title: 'Passphrases don\'t match',
        description: 'Please make sure both passphrases are identical.',
        variant: 'destructive',
      });
      return;
    }

    if (passphrase.length < 12) {
      toast({
        title: 'Passphrase too short',
        description: 'Please use at least 12 characters for security.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Generate keypair
      const keyPair = await generateUserKeypair();

      // Export public key
      const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);

      // Encrypt and export private key
      const { encryptedKey, salt, iv } = await encryptPrivateKey(
        keyPair.privateKey,
        passphrase
      );

      // Store in database
      const { error } = await supabase.from('user_keys').insert({
        user_id: user.id,
        public_key: publicKeyBase64,
        encrypted_private_key: JSON.stringify({ encryptedKey, salt, iv }),
        key_algorithm: 'RSA-OAEP',
      });

      if (error) throw error;

      toast({
        title: 'Encryption keys created',
        description: 'Your account is now ready for secure file sharing!',
      });

      onComplete();
    } catch (error: any) {
      console.error('Key setup error:', error);
      toast({
        title: 'Key setup failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl border-border/50 shadow-elevated bg-card/95">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
            <Key className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl">Setup Encryption Keys</CardTitle>
          <CardDescription>
            Create a secure passphrase to protect your encryption keys
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert className="bg-muted/50 border-border">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>CRITICAL:</strong> Your passphrase protects your private encryption key.
              If you lose it, you will not be able to decrypt your files. Store it securely!
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSetupKeys} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passphrase" className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Passphrase
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={handleGeneratePassphrase}
                  className="text-primary h-auto p-0"
                >
                  Generate secure passphrase
                </Button>
              </Label>
              <Input
                id="passphrase"
                type="text"
                placeholder="Enter a strong passphrase (12+ characters)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                required
                minLength={12}
                className="bg-muted/50 border-border font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 12 characters. Use a mix of words, numbers, and symbols.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassphrase" className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Confirm Passphrase
              </Label>
              <Input
                id="confirmPassphrase"
                type="text"
                placeholder="Re-enter your passphrase"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                required
                className="bg-muted/50 border-border font-mono"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:shadow-glow transition-all"
              disabled={loading || !passphrase || passphrase !== confirmPassphrase}
            >
              {loading ? 'Creating Keys...' : 'Create Encryption Keys'}
            </Button>
          </form>

          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-accent" />
              How it works
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• We generate a 4096-bit RSA keypair for you</li>
              <li>• Your private key is encrypted with your passphrase using AES-256</li>
              <li>• Only the encrypted private key is stored on our servers</li>
              <li>• You need your passphrase to decrypt files</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
