import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a fashion AI that analyzes garment photos. Return a JSON object with exactly these fields:
- name: a concise descriptive name (e.g. "Navy Linen Blazer")
- category: one of tops, bottoms, outerwear, dresses, shoes, accessories, bags, activewear
- color: the primary color
- material: best guess at fabric/material
- brand: brand if visible, otherwise empty string
- vibes: array of 1-3 from: corporate, casual, streetwear, brunch, evening, athletic, lazy_sunday, date_night

Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
              {
                type: "text",
                text: "Analyze this garment and return the JSON tags.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "tag_garment",
              description: "Tag a garment with structured attributes",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  category: { type: "string", enum: ["tops", "bottoms", "outerwear", "dresses", "shoes", "accessories", "bags", "activewear"] },
                  color: { type: "string" },
                  material: { type: "string" },
                  brand: { type: "string" },
                  vibes: {
                    type: "array",
                    items: { type: "string", enum: ["corporate", "casual", "streetwear", "brunch", "evening", "athletic", "lazy_sunday", "date_night"] },
                  },
                },
                required: ["name", "category", "color", "material", "brand", "vibes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "tag_garment" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const tags = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(tags), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try parsing from content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Could not parse AI response");
  } catch (e) {
    console.error("tag-garment error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
