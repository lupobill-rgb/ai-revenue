import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Send, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatProps {
  onClose: () => void;
  initialPrompt?: string | null;
}

interface AppContext {
  businessName: string | null;
  industry: string | null;
  currentRoute: string;
  leadCount: number;
  campaignCount: number;
  modulesEnabled: string[];
  icpSegments: string[];
  workspaceId: string | null;
}

const AIChat = ({ onClose, initialPrompt }: AIChatProps) => {
  const { toast } = useToast();
  const location = useLocation();
  const { workspaceId, workspace } = useWorkspaceContext();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your UbiGrowth AI Assistant. I can help you create campaigns, write content, optimize your marketing strategy, and answer questions about your account. What would you like help with today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [appContext, setAppContext] = useState<AppContext | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

  // Fetch application context on mount - scoped to workspace
  useEffect(() => {
    const fetchContext = async () => {
      if (!workspaceId) return;
      
      try {
        // Fetch business profile by workspace
        const { data: profile } = await supabase
          .from("business_profiles")
          .select("business_name, industry")
          .eq("workspace_id", workspaceId)
          .limit(1);

        const profileRow = profile?.[0] ?? null;

        // Fetch ICP segments
        const { data: segments } = await supabase
          .from("cmo_icp_segments")
          .select("segment_name")
          .eq("workspace_id", workspaceId)
          .limit(5);

        // Fetch lead count - crm_leads uses tenant_id, not workspace_id
        const tenantId = workspace?.tenant_id ?? null;

        let leadCount = 0;
        if (tenantId) {
          const { count } = await supabase
            .from("crm_leads")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId);
          leadCount = count || 0;
        }

        // Fetch campaign count scoped to workspace
        const { count: campaignCount } = await supabase
          .from("cmo_campaigns")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId as string);

        // Fetch enabled modules
        const { data: moduleAccess } = await supabase
          .from("tenant_module_access")
          .select("module_id, enabled")
          .eq("enabled", true);

        const modulesEnabled = moduleAccess?.map(m => m.module_id) || [];
        const icpSegments = segments?.map(s => s.segment_name).filter(Boolean) as string[] || [];

        setAppContext({
          businessName: profileRow?.business_name || null,
          industry: profileRow?.industry || null,
          currentRoute: location.pathname,
          leadCount: leadCount || 0,
          campaignCount: campaignCount || 0,
          modulesEnabled,
          icpSegments,
          workspaceId,
        });
      } catch (error) {
        console.error("Failed to fetch app context:", error);
      }
    };

    fetchContext();
  }, [workspaceId, location.pathname]);

  // Handle initial prompt
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      setTimeout(() => {
        if (initialPrompt.trim()) {
          streamChat(initialPrompt);
        }
      }, 500);
    }
  }, [initialPrompt]);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const streamChat = async (userMessage: string) => {
    setIsStreaming(true);
    const newUserMessage: Message = { role: "user", content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setInput("");

    try {
      // Get current user session token
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('[AIChat] Session check:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        tokenPreview: session?.access_token?.substring(0, 20) + '...',
        workspaceId: appContext?.workspaceId
      });
      
      if (!session?.access_token) {
        console.error('[AIChat] No access token found');
        toast({
          title: "Authentication Required",
          description: "Please sign in to use AI chat.",
          variant: "destructive",
        });
        setMessages(prev => prev.slice(0, -1));
        setIsStreaming(false);
        return;
      }

      console.log('[AIChat] Sending request to:', CHAT_URL);
      
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ 
          messages: [...messages, newUserMessage],
          context: appContext,
        }),
      });
      
      console.log('[AIChat] Response status:', resp.status);

      if (!resp.ok) {
        // Log full error details for debugging
        const errorText = await resp.text().catch(() => 'Unable to read error response');
        console.error('AI Chat API Error:', {
          status: resp.status,
          statusText: resp.statusText,
          url: CHAT_URL,
          errorBody: errorText
        });

        if (resp.status === 429) {
          toast({
            title: "Rate Limit",
            description: "Too many requests. Please wait a moment.",
            variant: "destructive",
          });
          setMessages(prev => prev.slice(0, -1));
          setIsStreaming(false);
          return;
        }
        if (resp.status === 402) {
          toast({
            title: "Credits Required",
            description: "Please add credits to continue using AI.",
            variant: "destructive",
          });
          setMessages(prev => prev.slice(0, -1));
          setIsStreaming(false);
          return;
        }
        if (resp.status === 401 || resp.status === 403) {
          toast({
            title: "Authentication Error",
            description: "Please sign out and sign in again.",
            variant: "destructive",
          });
          setMessages(prev => prev.slice(0, -1));
          setIsStreaming(false);
          return;
        }
        
        // Show detailed error in development, generic in production
        const isDev = import.meta.env.DEV;
        throw new Error(
          isDev 
            ? `AI Chat failed (${resp.status}): ${errorText}`
            : `Failed to send message (${resp.status}). Please try again.`
        );
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let assistantContent = "";

      // Add empty assistant message that we'll update
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            // Support both OpenAI and Gemini formats
            const content = parsed.choices?.[0]?.delta?.content || 
                           parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage?.role === "assistant") {
                  lastMessage.content = assistantContent;
                }
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send message. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      // Remove the failed user message
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    streamChat(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[600px] flex flex-col shadow-2xl border-primary/20 bg-background z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">UbiGrowth AI Assistant</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message, i) => (
            <div
              key={i}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your account..."
            rows={2}
            className="resize-none"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-full aspect-square"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default AIChat;
