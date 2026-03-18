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

    const { prompt, sourceImage } = await req.json();
    if (!prompt) throw new Error("Prompt is required");

    const messages: any[] = [];

    if (sourceImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: sourceImage } },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Generate an image of: ${prompt}`,
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages,
          modalities: ["image", "text"],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI gateway response keys:", JSON.stringify(Object.keys(data)));
    
    const choice = data.choices?.[0];
    if (choice) {
      console.log("Choice message keys:", JSON.stringify(Object.keys(choice.message || {})));
      console.log("Has images:", JSON.stringify(!!choice.message?.images));
      if (choice.message?.images) {
        console.log("Images count:", choice.message.images.length);
      }
      // Log content to see if image is inline
      const content = choice.message?.content;
      if (typeof content === "string") {
        console.log("Content starts with:", content.substring(0, 100));
      } else if (Array.isArray(content)) {
        console.log("Content is array with types:", JSON.stringify(content.map((c: any) => c.type)));
      }
    }

    // Try multiple extraction paths
    let imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    // Fallback: check if content is multipart with image_url
    if (!imageUrl) {
      const content = data.choices?.[0]?.message?.content;
      if (Array.isArray(content)) {
        const imgPart = content.find((c: any) => c.type === "image_url");
        imageUrl = imgPart?.image_url?.url;
      }
    }

    // Fallback: check inline_data
    if (!imageUrl) {
      const parts = data.choices?.[0]?.message?.content;
      if (Array.isArray(parts)) {
        const imgPart = parts.find((p: any) => p.type === "image" || p.inline_data);
        if (imgPart?.inline_data) {
          imageUrl = `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
        }
      }
    }

    if (!imageUrl) {
      console.error("Full response:", JSON.stringify(data).substring(0, 2000));
      throw new Error("No image was generated. Try a different prompt.");
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-image error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
