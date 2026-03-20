import React from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { Download, User, Sparkles } from "lucide-react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  attachedImages?: string[];
};

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === "user";

  const handleDownload = (imageUrl: string) => {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `pixelforge-${Date.now()}.png`;
    a.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
          isUser ? "bg-muted" : "bg-primary"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Attached images (user uploads) */}
        {message.attachedImages && message.attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachedImages.map((img, i) => (
              <div key={i} className="relative">
                <img
                  src={img}
                  alt={`img ${i + 1}`}
                  className="max-w-[160px] rounded-xl border border-border"
                />
                <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-background/80 text-foreground px-1.5 py-0.5 rounded">
                  img {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm ${
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-md"
                : "bg-card text-card-foreground border border-border rounded-tl-md"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Generated image */}
        {message.image && (
          <div className="relative group">
            <img
              src={message.image}
              alt="Generated"
              className="max-w-full rounded-xl border border-border"
              style={{ maxHeight: 400 }}
            />
            <button
              onClick={() => handleDownload(message.image!)}
              className="absolute bottom-3 right-3 p-2 rounded-lg bg-accent text-accent-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatMessage;
