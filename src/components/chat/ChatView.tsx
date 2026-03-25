import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ChatMessage, { type Message } from "./ChatMessage";
import ChatInput from "./ChatInput";
import ThemeToggle from "@/components/ThemeToggle";
import fitGlamLogoDark from "@/assets/FitGlam_logo_dark.png";
import fitGlamLogoLight from "@/assets/FitGlam_logo_light.png";
import { useTheme } from "@/hooks/use-theme";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = useCallback(async (text: string, attachedImages?: string[]) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      attachedImages,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Auto-detect image requests
    const isImage = imageMode || text.startsWith("/image ");
    const cleanText = text.startsWith("/image ") ? text.slice(7) : text;

    try {
      if (isImage) {
        // Non-streaming image generation
        const { data, error } = await supabase.functions.invoke("chat", {
          body: {
            messages: [{ role: "user", content: cleanText, images: attachedImages }],
            mode: "image",
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.content || "",
          image: data.imageUrl,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        // Streaming text chat
        const historyForApi = [...messages, userMsg]
          .filter((m) => !m.image && (!m.attachedImages || m.attachedImages.length === 0))
          .map((m) => ({ role: m.role, content: m.content }));

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: historyForApi, mode: "text" }),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || `Error ${resp.status}`);
        }

        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let assistantContent = "";
        const assistantId = crypto.randomUUID();

        // Add empty assistant message
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

        let streamDone = false;
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
            if (jsonStr === "[DONE]") { streamDone = true; break; }
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
                );
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong");
      // Add error message
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${e.message || "Something went wrong. Please try again."}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, imageMode]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <img src={fitGlamLogo} alt="FitGlam" className="h-10 w-auto" />
        <h1 className="text-xl font-display font-bold text-foreground tracking-tight">
          FitGlam
        </h1>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md font-medium">AI Fashion Assistant</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-semibold text-foreground mb-1">
                  Welcome to PixelForge
                </h2>
                <p className="text-muted-foreground text-sm max-w-md">
                  Chat with me or toggle image mode (🖼️) to generate images. You can also type <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/image</code> before your prompt.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-card border border-border">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        imageMode={imageMode}
        onToggleImageMode={() => setImageMode((p) => !p)}
      />
    </div>
  );
};

export default ChatView;
