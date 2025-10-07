import { useState } from 'react';
import { MessageSquare, Send, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function SecurityAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your security assistant. I can help explain encryption concepts, suggest secure passphrases, and answer questions about file security. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('security-assistant', {
        body: { message: userMessage },
      });

      if (error) throw error;

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.reply },
        ]);
      }
    } catch (error: any) {
      console.error('Assistant error:', error);
      toast({
        title: 'Assistant unavailable',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
      
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px] bg-card/80 backdrop-blur-sm border-border/50">
      <div className="p-4 border-b border-border bg-gradient-glass">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              Security Assistant
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </h3>
            <p className="text-xs text-muted-foreground">
              Ask me about encryption & security
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-glow">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <div
                className={`rounded-lg p-3 max-w-[80%] ${
                  msg.role === 'user'
                    ? 'bg-gradient-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-glow">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="rounded-lg p-3 bg-muted">
                <p className="text-sm text-muted-foreground animate-pulse">
                  Thinking...
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border bg-gradient-glass">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about encryption, security, or file protection..."
            disabled={loading}
            className="bg-background/50 border-border"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-gradient-primary hover:shadow-glow transition-all"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Try asking: "How does encryption work?" or "Suggest a secure passphrase"
        </p>
      </div>
    </Card>
  );
}
