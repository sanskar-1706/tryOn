import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, RefreshCw, Upload, Sparkles, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [usedPrompt, setUsedPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [mode, setMode] = useState<"generate" | "edit">("generate");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setGeneratedImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt: prompt.trim(),
          sourceImage: mode === "edit" ? uploadedImage : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedImage(data.imageUrl);
      setUsedPrompt(prompt.trim());
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate image");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, mode, uploadedImage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setMode("edit");
    };
    reader.readAsDataURL(file);
  };

  const clearUpload = () => {
    setUploadedImage(null);
    setMode("generate");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement("a");
    a.href = generatedImage;
    a.download = `generated-${Date.now()}.png`;
    a.click();
  };

  const handleRegenerate = () => {
    if (usedPrompt) {
      setPrompt(usedPrompt);
      handleGenerate();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground tracking-tight">
            PixelForge
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { clearUpload(); setMode("generate"); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "generate"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Text → Image
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "edit"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Image → Image
          </button>
        </div>
      </header>

      {/* Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl aspect-square rounded-xl shimmer"
            />
          ) : generatedImage ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative group w-full max-w-2xl"
            >
              {mode === "edit" && uploadedImage ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Original</p>
                    <img
                      src={uploadedImage}
                      alt="Original"
                      className="w-full rounded-xl border border-border"
                    />
                  </div>
                  <div className="relative">
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Edited</p>
                    <img
                      src={generatedImage}
                      alt="Generated"
                      className="w-full rounded-xl border border-border"
                    />
                  </div>
                </div>
              ) : (
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="w-full rounded-xl border border-border"
                />
              )}

              {/* Action toolbar */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={handleDownload}
                  className="p-2.5 rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 transition-colors shadow-lg"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRegenerate}
                  className="p-2.5 rounded-lg bg-card text-foreground hover:bg-muted transition-colors shadow-lg border border-border"
                  title="Regenerate"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : uploadedImage ? (
            <motion.div
              key="uploaded"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md"
            >
              <img src={uploadedImage} alt="Uploaded" className="w-full rounded-xl border border-border" />
              <button
                onClick={clearUpload}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-card/80 text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-center text-sm text-muted-foreground mt-3">
                Enter a prompt below to edit this image
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-semibold text-foreground mb-1">
                  Create something amazing
                </h2>
                <p className="text-muted-foreground text-sm max-w-md">
                  Type a prompt below or upload an image to get started
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prompt metadata */}
        {usedPrompt && generatedImage && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            <div className="bg-card border border-border rounded-lg px-4 py-3 font-mono text-sm text-muted-foreground">
              <span className="text-primary font-medium">prompt:</span> {usedPrompt}
            </div>
          </motion.div>
        )}
      </main>

      {/* Command bar */}
      <div className="sticky bottom-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex-shrink-0"
            title="Upload image"
          >
            <Upload className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "edit"
                  ? "Describe how to edit this image..."
                  : "Describe the image you want to create..."
              }
              className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all text-sm"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-display font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {isLoading ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;
