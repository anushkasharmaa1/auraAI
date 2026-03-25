import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) throw new Error("imageBase64 is required");

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
            content: `You are a fashion product data extractor. You analyze screenshots of online store product pages, receipts, order confirmations, or shopping app screens.

Extract the garment information visible in the screenshot. Look for:
- Product name from the title/heading
- Brand name from the store or product listing
- Price from the displayed price tag
- Category, color, material from the product description or image
- Style vibes based on the garment type
- Product image URL if visible in the page (look for the main product photo URL in any visible elements)

If you can see the actual garment in the screenshot, describe it. If it's just text (like a receipt), infer what you can from the product name and description.

Return your findings using the extract_product tool.`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageBase64 } },
              {
                type: "text",
                text: "Extract the product/garment information from this screenshot. Get the name, brand, price, category, color, material, and vibes.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_product",
              description: "Return extracted product information from a screenshot",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Product name e.g. 'Relaxed Fit Linen Blazer'" },
                  brand: { type: "string", description: "Brand name e.g. 'Zara', 'H&M', 'ASOS'" },
                  price: { type: "number", description: "Price in the displayed currency, numbers only" },
                  currency: { type: "string", description: "Currency code e.g. USD, EUR, GBP" },
                  category: {
                    type: "string",
                    enum: ["tops", "bottoms", "outerwear", "dresses", "shoes", "accessories", "bags", "activewear"],
                  },
                  color: { type: "string", description: "Primary color of the garment" },
                  material: { type: "string", description: "Fabric/material if mentioned" },
                  vibes: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["corporate", "casual", "streetwear", "brunch", "evening", "athletic", "lazy_sunday", "date_night"],
                    },
                  },
                  product_image_url: {
                    type: "string",
                    description: "URL of the product image if visible in the screenshot. Leave empty string if not found.",
                  },
                  description: {
                    type: "string",
                    description: "Brief description of the garment for context",
                  },
                },
                required: ["name", "brand", "price", "category", "color", "material", "vibes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_product" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI extraction failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Could not parse AI response");
  } catch (e) {
    console.error("screenshot-sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
