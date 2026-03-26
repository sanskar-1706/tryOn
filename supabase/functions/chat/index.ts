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

      const hasMultipleImages = lastMsg.images && Array.isArray(lastMsg.images) && lastMsg.images.length > 1;
      const hasSingleImage = lastMsg.images && Array.isArray(lastMsg.images) && lastMsg.images.length === 1;

      if (hasMultipleImages || hasSingleImage) {
        const contentParts: any[] = [];

        // For multi-image (e.g. virtual try-on), add a clear system-like instruction
        if (hasMultipleImages) {
          contentParts.push({
            type: "text",
            text: `You are an expert AI fashion stylist and virtual try-on specialist. The user has provided ${lastMsg.images.length} images labeled img 1 through img ${lastMsg.images.length}.

VIRTUAL TRY-ON RULES:
- Carefully analyze the POSE and ANGLE of the person photo (front view, side view, 3/4 view, back view, etc.).
- Extract the garment from the clothing image and realistically fit it onto the person while MATCHING THE EXACT BODY ANGLE AND PERSPECTIVE.
- For SIDE VIEW photos: warp and perspective-transform the garment so it naturally wraps around the body as seen from the side. Show only the visible side of the garment with proper foreshortening, creases, and fabric draping that match a lateral perspective.
- For 3/4 VIEW photos: adjust the garment to show the correct proportion of front and side, matching the person's exact turn angle.
- For BACK VIEW photos: show the back of the garment fitted to the person's back pose.
- ALWAYS preserve: the person's exact pose, body proportions, skin tone, hair, face, and background.
- ALWAYS preserve: the garment's exact color, pattern, texture, logos, and design details.
- Ensure realistic shadows, fabric folds, wrinkles, and lighting that match the person's photo lighting conditions.
- The output must look like a professional e-commerce photo — ultra-realistic, high-resolution, no artifacts.

User instruction: ${lastMsg.content}`,
          });
        } else {
          contentParts.push({ type: "text", text: lastMsg.content });
        }

        lastMsg.images.forEach((img: string) => {
          contentParts.push({ type: "image_url", image_url: { url: img } });
        });

        aiMessages.push({ role: "user", content: contentParts });
      } else {
        aiMessages.push({
          role: "user",
          content: `Generate an image of: ${lastMsg.content}`,
        });
      }

      // Use a better model for multi-image editing tasks
      const model = hasMultipleImages
        ? "google/gemini-2.5-flash-image"
        : "google/gemini-2.5-flash-image";

      const maxRetries = 2;
      let lastError = "";

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: aiMessages,
            modalities: ["image", "text"],
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            if (attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
              continue;
            }
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
          lastError = `AI gateway error: ${response.status}`;
          if (attempt < maxRetries) continue;
          throw new Error(lastError);
        }

        const data = await response.json();
        
        // Try multiple paths to find the image
        let imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageUrl) {
          const content = data.choices?.[0]?.message?.content;
          if (Array.isArray(content)) {
            const imgPart = content.find((c: any) => c.type === "image_url");
            imageUrl = imgPart?.image_url?.url;
            if (!imageUrl) {
              const inlinePart = content.find((p: any) => p.type === "image" || p.inline_data);
              if (inlinePart?.inline_data) {
                imageUrl = `data:${inlinePart.inline_data.mime_type};base64,${inlinePart.inline_data.data}`;
              }
            }
          }
        }

        if (imageUrl) {
          const textContent = data.choices?.[0]?.message?.content;
          const responseText = typeof textContent === "string" ? textContent : "Here's your generated image!";
          return new Response(
            JSON.stringify({ type: "image", content: responseText, imageUrl }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // No image found - retry with slightly modified prompt
        console.error("No image in response, attempt", attempt);
        lastError = "No image generated";
        if (attempt < maxRetries) {
          // Slightly rephrase for retry
          if (aiMessages[0]?.content && typeof aiMessages[0].content === "string") {
            aiMessages[0].content += " (please generate a visual image)";
          } else if (Array.isArray(aiMessages[0]?.content)) {
            const textPart = aiMessages[0].content.find((p: any) => p.type === "text");
            if (textPart) textPart.text += " Please output an image.";
          }
          continue;
        }
      }

      return new Response(
        JSON.stringify({ type: "text", content: "I wasn't able to generate an image. Try rephrasing your prompt or using fewer/smaller images." }),
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
