import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { messages, mode } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error("messages array is required");

    // Determine if user wants image generation based on the mode flag from client
    const isImageRequest = mode === "image";

    if (isImageRequest) {
      // Use the image generation model (non-streaming)
      const lastMsg = messages[messages.length - 1];
      const aiMessages: any[] = [];

      // Build message content - check if there's an attached image
      if (lastMsg.image) {
        aiMessages.push({
          role: "user",
          content: [
            { type: "text", text: lastMsg.content },
            { type: "image_url", image_url: { url: lastMsg.image } },
          ],
        });
      } else {
        aiMessages.push({
          role: "user",
          content: `Generate an image of: ${lastMsg.content}`,
        });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: aiMessages,
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Usage credits exhausted. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const text = await response.text();
        console.error("AI gateway error:", response.status, text);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      let imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageUrl) {
        const content = data.choices?.[0]?.message?.content;
        if (Array.isArray(content)) {
          const imgPart = content.find((c: any) => c.type === "image_url");
          imageUrl = imgPart?.image_url?.url;
        }
      }

      if (!imageUrl) {
        const parts = data.choices?.[0]?.message?.content;
        if (Array.isArray(parts)) {
          const imgPart = parts.find((p: any) => p.type === "image" || p.inline_data);
          if (imgPart?.inline_data) {
            imageUrl = `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
          }
        }
      }

      const textContent = data.choices?.[0]?.message?.content;
      const responseText = typeof textContent === "string" ? textContent : "Here's your generated image!";

      if (!imageUrl) {
        return new Response(
          JSON.stringify({ type: "text", content: "I wasn't able to generate an image for that prompt. Try rephrasing it!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ type: "image", content: responseText, imageUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Text chat mode - streaming
    const systemPrompt = `You are PixelForge, a creative AI assistant. You can have conversations and also generate images.

When the user wants to generate or create an image, tell them to click the image mode button (🖼️) or start their message with "/image". 

Be helpful, creative, and concise. Use markdown formatting when appropriate.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
