import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { storageSet } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";

interface WelcomeModalProps {
  onStartTour: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_SEEN_KEY = "ubigrowth_welcome_seen";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-assistant`;

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onStartTour }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  // Opening is now controlled by App.tsx which checks the database
  // This component just needs to ensure it opens when mounted
  useEffect(() => {
    if (user) {
      setIsOpen(true);
    }
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startChat = async () => {
    setShowChat(true);
    setIsLoading(true);

    try {
      await streamChat({
        messages: [],
        onDelta: (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: m.content + chunk } : m));
            }
            return [...prev, { role: "assistant", content: chunk }];
          });
        },
        onDone: () => setIsLoading(false),
      });
    } catch (error) {
      console.error("Error starting chat:", error);
      setMessages([{ role: "assistant", content: `Hi ${userName}! Welcome to UbiGrowth AI. I'm here to help you get started. What would you like to accomplish with your marketing today?` }]);
      setIsLoading(false);
    }
  };

  const streamChat = async ({
    messages: chatMessages,
    onDelta,
    onDone,
  }: {
    messages: Message[];
    onDelta: (text: string) => void;
    onDone: () => void;
  }) => {
    // Get user session token
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('[Onboarding] Session check:', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      tokenPreview: session?.access_token?.substring(0, 20) + '...'
    });
    
    if (!session?.access_token) {
      console.error('[Onboarding] No access token');
      throw new Error("Authentication required");
    }

    console.log('[Onboarding] Sending request to:', CHAT_URL);

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages: chatMessages, userName }),
    });
    
    console.log('[Onboarding] Response status:', resp.status);

    if (!resp.ok || !resp.body) {
      throw new Error("Failed to start stream");
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";

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
          // Support multiple provider stream formats
          const content = parsed.choices?.[0]?.delta?.content || 
                         parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    onDone();
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      await streamChat({
        messages: newMessages,
        onDelta: (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: m.content + chunk } : m));
            }
            return [...prev, { role: "assistant", content: chunk }];
          });
        },
        onDone: () => setIsLoading(false),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
    }
  };

  const handleStartTour = () => {
    storageSet(WELCOME_SEEN_KEY, "true");
    setIsOpen(false);
    onStartTour();
  };

  const handleSkip = () => {
    storageSet(WELCOME_SEEN_KEY, "true");
    setIsOpen(false);
  };

  const steps = [
    { number: 1, title: "Create AI-powered campaigns in seconds" },
    { number: 2, title: "Review and approve generated content" },
    { number: 3, title: "Deploy to email, social, and voice channels" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden">
        {!showChat ? (
          <div className="p-6">
            <DialogHeader className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary-foreground" />
              </div>
              <DialogTitle className="text-2xl font-bold">
                Welcome to UbiGrowth AI!
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Your AI-powered marketing automation platform that creates, optimizes, and deploys campaigns across all channels.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-3">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="flex items-center gap-4 p-3 border rounded-lg bg-card"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                    {step.number}
                  </div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={handleStartTour} className="w-full gap-2">
                <ArrowRight className="w-4 h-4" />
                Start Tour (2 min)
              </Button>
              <Button onClick={startChat} variant="outline" className="w-full gap-2">
                <Sparkles className="w-4 h-4" />
                Chat with AI Assistant
              </Button>
              <Button variant="ghost" onClick={handleSkip} className="w-full text-muted-foreground">
                Skip for now
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-[500px]">
            <div className="p-4 border-b bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">AI Onboarding Assistant</h3>
                  <p className="text-xs text-muted-foreground">Here to help you get started</p>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && messages.length === 0 && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-2.5">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={handleStartTour} className="flex-1">
                  Start Tour
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSkip} className="flex-1 text-muted-foreground">
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
