import React, { useEffect, useRef, useState } from "react";
import { Send, ImageIcon, Upload, X, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string, images?: string[]) => void;
  isLoading: boolean;
  imageMode: boolean;
  onToggleImageMode: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, imageMode, onToggleImageMode }) => {
  const [text, setText] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const addImageFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImageFiles(imageFiles);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addImageFiles(e.dataTransfer.files);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed, attachedImages.length > 0 ? attachedImages : undefined);
    setText("");
    setAttachedImages([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 bg-background/80 backdrop-blur-xl border-t border-border">
      <div className="max-w-3xl mx-auto">
        {/* Attached images preview */}
        {attachedImages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-3">
            {attachedImages.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img} alt={`img ${i + 1}`} className="h-20 rounded-lg border border-border" />
                <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-background/80 text-foreground px-1.5 py-0.5 rounded">
                  img {i + 1}
                </span>
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />

          <button
            onClick={() => fileRef.current?.click()}
            className="p-3 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex-shrink-0"
            title="Upload images"
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
              placeholder={imageMode ? (attachedImages.length > 1 ? "Describe how to combine/edit these images..." : attachedImages.length === 1 ? "Describe how to edit this image..." : "Describe the image you want...") : "Type a message..."}
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
