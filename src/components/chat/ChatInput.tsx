import React, { useRef, useState } from "react";
import { Send, ImageIcon, Upload, X, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string, image?: string) => void;
  isLoading: boolean;
  imageMode: boolean;
  onToggleImageMode: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, imageMode, onToggleImageMode }) => {
  const [text, setText] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed, attachedImage ?? undefined);
    setText("");
    setAttachedImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4 bg-background/80 backdrop-blur-xl border-t border-border">
      <div className="max-w-3xl mx-auto">
        {/* Attached image preview */}
        {attachedImage && (
          <div className="mb-3 relative inline-block">
            <img src={attachedImage} alt="Attached" className="h-20 rounded-lg border border-border" />
            <button
              onClick={() => { setAttachedImage(null); if (fileRef.current) fileRef.current.value = ""; }}
              className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

          <button
            onClick={() => fileRef.current?.click()}
            className="p-3 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex-shrink-0"
            title="Upload image"
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={onToggleImageMode}
            className={`p-3 rounded-xl border transition-colors flex-shrink-0 ${
              imageMode
                ? "bg-primary/20 border-primary text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            }`}
            title={imageMode ? "Image generation mode" : "Chat mode"}
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={imageMode ? "Describe the image you want..." : "Type a message..."}
              className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all text-sm"
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={isLoading || !text.trim()}
            className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>

        {imageMode && (
          <p className="text-xs text-primary mt-2 text-center font-medium">
            🖼️ Image generation mode — your prompt will generate an image
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
