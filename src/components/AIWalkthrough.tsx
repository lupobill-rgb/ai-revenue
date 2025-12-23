import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Sparkles, Bot, User, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIWalkthroughProps {
  onClose?: () => void;
  forceShow?: boolean;
}

const WALKTHROUGH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-walkthrough`;

const AIWalkthrough = ({ onClose, forceShow = false }: AIWalkthroughProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { workspaceId } = useWorkspaceContext();

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      if (!hasStarted) {
        startWalkthrough();
      }
      return;
    }

    const hasSeenWalkthrough = localStorage.getItem("ai-walkthrough-seen");
    if (!hasSeenWalkthrough) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        startWalkthrough();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startWalkthrough = async () => {
    if (hasStarted) return;
    setHasStarted(true);
    setIsLoading(true);

    try {
      const resp = await fetch(WALKTHROUGH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [], isFirstMessage: true, workspaceId }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error("Failed to start walkthrough");
      }

      await streamResponse(resp.body);
    } catch (error) {
      console.error("Walkthrough error:", error);
      setMessages([{
        role: "assistant",
        content: "👋 Welcome! I'm here to help you navigate the platform. What would you like to accomplish with your marketing today?"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const streamResponse = async (body: ReadableStream<Uint8Array>) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    // Add empty assistant message
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    while (true) {
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
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: assistantContent };
              return updated;
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch(WALKTHROUGH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, isFirstMessage: false, workspaceId }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      if (resp.body) {
        await streamResponse(resp.body);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I had trouble responding. Please try again!"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    localStorage.setItem("ai-walkthrough-seen", "true");
    setIsVisible(false);
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Parse message for navigation links
  const parseMessageContent = (content: string) => {
    const routePattern = /\(\/([a-z-]+)\)/g;
    const parts = content.split(routePattern);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a route
        const route = `/${part}`;
        return (
          <button
            key={index}
            onClick={() => {
              navigate(route);
              handleClose();
            }}
            className="text-primary hover:underline font-medium"
          >
            Go there →
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Chat Card */}
      <Card className="relative z-10 w-full max-w-md border-primary/20 shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[600px]">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Guide</CardTitle>
                <p className="text-xs text-muted-foreground">Your personal platform assistant</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === "user" ? "bg-primary" : "bg-muted"
                  }`}>
                    {msg.role === "user" ? (
                      <User className="h-4 w-4 text-primary-foreground" />
                    ) : (
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className={`flex-1 px-4 py-3 rounded-2xl ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : "bg-muted rounded-tl-sm"
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.role === "assistant" ? parseMessageContent(msg.content) : msg.content}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="bg-muted px-4 py-3 rounded-2xl rounded-tl-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about any feature..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={handleSend} 
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Ask me anything about the platform
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIWalkthrough;
