import { useState, useEffect } from 'react';
import { Shield, LogOut, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FileUpload } from './FileUpload';
import { FileList } from './FileList';
import { SecurityAssistant } from './SecurityAssistant';
import { KeySetup } from './KeySetup';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [hasKeys, setHasKeys] = useState<boolean | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    checkUserKeys();
  }, [user]);

  const checkUserKeys = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_keys')
      .select('id')
      .eq('user_id', user.id)
      .single();

    setHasKeys(!!data);
  };

  if (hasKeys === null) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading...</p>
    </div>;
  }

  if (!hasKeys) {
    return <KeySetup onComplete={() => setHasKeys(true)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              SecureShare
            </h1>
          </div>
          <Button onClick={signOut} variant="ghost">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="files" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="files">My Files</TabsTrigger>
            <TabsTrigger value="assistant">Security Assistant</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-6">
            <FileUpload onUploadComplete={() => setRefreshTrigger(prev => prev + 1)} />
            <div>
              <h2 className="text-xl font-semibold mb-4">Encrypted Files</h2>
              <FileList refreshTrigger={refreshTrigger} />
            </div>
          </TabsContent>

          <TabsContent value="assistant">
            <SecurityAssistant />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
