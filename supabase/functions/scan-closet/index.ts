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
    const { imageBase64 } = await req.json();
    if (!imageBase64) throw new Error("imageBase64 is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Step 1: Detect multiple garments in the image
    const detectResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
              content: `You are a fashion AI that detects multiple garments in photos of closets, clothing racks, or flat-lays.

Analyze the image and identify each distinct garment you can see. For EACH garment, return its attributes.

Return your results using the detect_garments tool. You should detect between 1 and 12 garments.
If you only see a single garment, return an array with one item.
Focus on clearly visible, distinct items — skip anything too blurry or obscured.`,
            },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: imageBase64 } },
                {
                  type: "text",
                  text: "Detect every distinct garment in this image. Tag each one with name, category, color, material, brand (if visible), and vibes.",
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "detect_garments",
                description:
                  "Return an array of detected garments with their attributes and approximate positions",
                parameters: {
                  type: "object",
                  properties: {
                    garments: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            description:
                              "Concise descriptive name e.g. 'Navy Linen Blazer'",
                          },
                          category: {
                            type: "string",
                            enum: [
                              "tops",
                              "bottoms",
                              "outerwear",
                              "dresses",
                              "shoes",
                              "accessories",
                              "bags",
                              "activewear",
                            ],
                          },
                          color: { type: "string" },
                          material: { type: "string" },
                          brand: { type: "string" },
                          vibes: {
                            type: "array",
                            items: {
                              type: "string",
                              enum: [
                                "corporate",
                                "casual",
                                "streetwear",
                                "brunch",
                                "evening",
                                "athletic",
                                "lazy_sunday",
                                "date_night",
                              ],
                            },
                          },
                          position: {
                            type: "object",
                            description:
                              "Approximate bounding box as fractions 0-1 of image dimensions",
                            properties: {
                              x: { type: "number" },
                              y: { type: "number" },
                              width: { type: "number" },
                              height: { type: "number" },
                            },
                            required: ["x", "y", "width", "height"],
                          },
                        },
                        required: [
                          "name",
                          "category",
                          "color",
                          "material",
                          "brand",
                          "vibes",
                          "position",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["garments"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "detect_garments" },
          },
        }),
      }
    );

    if (!detectResponse.ok) {
      if (detectResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again shortly" }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (detectResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const text = await detectResponse.text();
      console.error("AI gateway error:", detectResponse.status, text);
      throw new Error("AI detection failed");
    }

    const data = await detectResponse.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: parse from content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Could not parse AI response");
  } catch (e) {
    console.error("scan-closet error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
