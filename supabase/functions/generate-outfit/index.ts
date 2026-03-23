import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { garments, weather, occasion, mode } = await req.json();
    // mode: "daily" | "weather" | "occasion"

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!garments || garments.length === 0) {
      return new Response(JSON.stringify({ error: "No garments in closet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build garment inventory summary
    const inventory = garments.map((g: any, i: number) => 
      `${i + 1}. "${g.name || 'Unnamed'}" — ${g.category || 'unknown'}, ${g.color || 'unknown color'}, ${g.material || 'unknown material'}, vibes: [${(g.vibes || []).join(', ')}], laundry: ${g.laundry_status}, worn ${g.wear_count}x${g.price ? `, $${g.price}` : ''}`
    ).join('\n');

    let systemPrompt = `You are Aura, an expert AI wardrobe stylist. You have deep knowledge of fashion, color theory, layering, and occasion-appropriate dressing.

RULES:
- Only recommend items from the user's closet inventory below.
- Never recommend items marked as "dirty" or "at_cleaners".
- Prefer items with lower wear counts to encourage wardrobe variety.
- Items not worn in 30+ days should be prioritized ("Dust Collectors").
- Return EXACTLY the item numbers from the inventory.

USER'S CLOSET INVENTORY:
${inventory}`;

    let userPrompt = "";

    if (mode === "daily") {
      systemPrompt += `\n\nWEATHER CONDITIONS: ${weather ? `${weather.temp}°C, ${weather.description}, humidity ${weather.humidity}%` : 'Unknown'}`;
      systemPrompt += `\n\nWEATHER RULES:
- If temp > 25°C: EXCLUDE outerwear, heavy knits, wool items
- If temp < 10°C: INCLUDE outerwear, prefer warm materials
- If rainy/wet: Prefer water-resistant items, avoid suede/delicate fabrics
- If 15-25°C: Light layers work well`;

      userPrompt = "Generate a complete daily outfit recommendation for today. Pick 3-5 pieces that work well together. Explain why each piece was chosen and how they complement each other.";
    } else if (mode === "weather") {
      systemPrompt += `\n\nWEATHER CONDITIONS: ${weather ? `${weather.temp}°C, ${weather.description}, humidity ${weather.humidity}%, wind ${weather.wind_speed} km/h` : 'Unknown'}`;
      
      userPrompt = `Analyze my wardrobe for weather-appropriateness given today's conditions. 
1. List items that are PERFECT for this weather.
2. List items that should be LOCKED (hidden from suggestions) because they're inappropriate.  
3. Suggest a weather-optimized outfit from the appropriate items.`;
    } else if (mode === "occasion") {
      userPrompt = `I have the following event/occasion today: "${occasion}". 
Build me a complete outfit from my closet that's perfect for this. Consider formality level, comfort, and style cohesion. If weather info is available, factor that in too.`;
      if (weather) {
        systemPrompt += `\n\nWEATHER: ${weather.temp}°C, ${weather.description}`;
      }
    }

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
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "outfit_recommendation",
              description: "Return a structured outfit recommendation",
              parameters: {
                type: "object",
                properties: {
                  outfit_name: { type: "string", description: "A creative name for this look" },
                  pieces: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        item_number: { type: "number", description: "Item number from inventory" },
                        role: { type: "string", description: "Role in outfit: top, bottom, layer, shoes, accessory" },
                        reason: { type: "string", description: "Why this piece was chosen" },
                      },
                      required: ["item_number", "role", "reason"],
                      additionalProperties: false,
                    },
                  },
                  styling_notes: { type: "string", description: "Overall styling advice and tips" },
                  weather_advisory: { type: "string", description: "Weather-specific notes if applicable" },
                  locked_items: {
                    type: "array",
                    items: { type: "number" },
                    description: "Item numbers that should be locked/hidden due to weather incompatibility",
                  },
                  dust_collectors: {
                    type: "array",
                    items: { type: "number" },
                    description: "Item numbers not worn recently that were intentionally included",
                  },
                },
                required: ["outfit_name", "pieces", "styling_notes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "outfit_recommendation" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI recommendation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const recommendation = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(recommendation), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Could not parse AI response");
  } catch (e) {
    console.error("generate-outfit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
