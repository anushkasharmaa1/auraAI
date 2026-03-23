import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Garment } from "@/types/aura";
import { Sparkles, Cloud, Calendar, MapPin, Loader2, ThermometerSun, Droplets, Wind, ShirtIcon, Lock, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Weather {
  temp: number;
  description: string;
  humidity: number;
  wind_speed: number;
  icon: string;
}

interface OutfitPiece {
  item_number: number;
  role: string;
  reason: string;
}

interface Recommendation {
  outfit_name: string;
  pieces: OutfitPiece[];
  styling_notes: string;
  weather_advisory?: string;
  locked_items?: number[];
  dust_collectors?: number[];
}

type Mode = "daily" | "weather" | "occasion";

const ease = [0.16, 1, 0.3, 1] as const;

export default function StylistPage() {
  const { user } = useAuth();
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<Mode>("daily");
  const [occasion, setOccasion] = useState("");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [generating, setGenerating] = useState(false);
  const [locationName, setLocationName] = useState("");

  // Fetch garments
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("garments")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setGarments(data as Garment[]);
      setLoading(false);
    })();
  }, [user]);

  // Fetch weather via Open-Meteo (no API key needed)
  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      // Get user location
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;

      // Reverse geocode for city name
      try {
        const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const geoData = await geoRes.json();
        setLocationName(geoData.city || geoData.locality || "Your area");
      } catch { setLocationName("Your area"); }

      // Open-Meteo weather
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
      );
      const data = await res.json();
      const current = data.current;

      const wmoDescriptions: Record<number, string> = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Foggy", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
        61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
        80: "Rain showers", 81: "Heavy showers", 82: "Violent showers",
        95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
      };

      setWeather({
        temp: Math.round(current.temperature_2m),
        description: wmoDescriptions[current.weather_code] || "Unknown",
        humidity: current.relative_humidity_2m,
        wind_speed: Math.round(current.wind_speed_10m),
        icon: current.weather_code <= 3 ? "☀️" : current.weather_code <= 48 ? "☁️" : current.weather_code <= 65 ? "🌧️" : "❄️",
      });
    } catch (e) {
      console.error("Weather fetch failed:", e);
      toast.error("Could not get your location. Enable location access and try again.");
    }
    setWeatherLoading(false);
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  const generateOutfit = async () => {
    if (garments.length === 0) {
      toast.error("Add some garments to your closet first");
      return;
    }
    if (activeMode === "occasion" && !occasion.trim()) {
      toast.error("Describe your occasion first");
      return;
    }

    setGenerating(true);
    setRecommendation(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-outfit", {
        body: {
          garments: garments.map(g => ({
            name: g.name,
            category: g.category,
            color: g.color,
            material: g.material,
            vibes: g.vibes,
            laundry_status: g.laundry_status,
            wear_count: g.wear_count,
            price: g.price,
            last_worn_at: g.last_worn_at,
          })),
          weather,
          occasion: occasion.trim(),
          mode: activeMode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRecommendation(data as Recommendation);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate outfit");
    }
    setGenerating(false);
  };

  const modes = [
    { key: "daily" as Mode, icon: Sparkles, label: "Daily Outfit", desc: "AI picks based on weather & your style" },
    { key: "weather" as Mode, icon: Cloud, label: "Weather Check", desc: "See what works for today's conditions" },
    { key: "occasion" as Mode, icon: Calendar, label: "Occasion Mode", desc: "Tell it about your day" },
  ];

  const cleanGarmentCount = garments.filter(g => g.laundry_status === "clean").length;

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-6">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-1 font-sans">AI Powered</p>
        <h1 className="text-3xl">Your Stylist</h1>
      </motion.div>

      {/* Weather Card */}
      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
        transition={{ duration: 0.5, delay: 0.1, ease }}
        className="surface-elevated rounded-sm p-4 mb-6"
      >
        {weatherLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-sans">Getting your weather…</span>
          </div>
        ) : weather ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{weather.icon}</span>
              <div>
                <p className="text-sm font-sans font-medium">{weather.temp}°C — {weather.description}</p>
                <p className="text-xs text-muted-foreground font-sans flex items-center gap-2">
                  <MapPin className="w-3 h-3" />{locationName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground font-sans">
              <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{weather.humidity}%</span>
              <span className="flex items-center gap-1"><Wind className="w-3 h-3" />{weather.wind_speed} km/h</span>
              <button onClick={fetchWeather} className="p-1 hover:text-foreground transition-colors active:scale-95">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button onClick={fetchWeather} className="flex items-center gap-2 text-sm text-muted-foreground font-sans hover:text-foreground transition-colors">
            <MapPin className="w-4 h-4" />Enable location for weather-aware styling
          </button>
        )}
      </motion.div>

      {/* Mode Selector */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease }}
        className="grid grid-cols-3 gap-2 mb-6"
      >
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => { setActiveMode(m.key); setRecommendation(null); }}
            className={`relative p-3 rounded-sm text-left transition-all active:scale-[0.97] ${
              activeMode === m.key
                ? "surface-elevated shadow-[0_1px_4px_hsl(var(--foreground)/0.08)]"
                : "hover:bg-muted/50"
            }`}
          >
            <m.icon className={`w-4 h-4 mb-2 ${activeMode === m.key ? "text-accent" : "text-muted-foreground"}`} />
            <p className="text-xs font-sans font-medium">{m.label}</p>
            <p className="text-[10px] text-muted-foreground font-sans leading-snug mt-0.5 hidden sm:block">{m.desc}</p>
          </button>
        ))}
      </motion.div>

      {/* Occasion Input */}
      <AnimatePresence>
        {activeMode === "occasion" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease }}
            className="mb-6 overflow-hidden"
          >
            <Input
              placeholder="e.g. 9 AM board meeting then dinner at 7…"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="h-11 bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-foreground font-sans"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Button */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease }}
        className="mb-8"
      >
        <Button
          onClick={generateOutfit}
          disabled={generating || loading || garments.length === 0}
          className="w-full h-12 text-sm font-sans font-medium tracking-wide active:scale-[0.98] transition-transform"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Styling your look…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />
              {activeMode === "daily" ? "Generate Today's Look" :
               activeMode === "weather" ? "Check Weather Compatibility" :
               "Style My Occasion"}
            </>
          )}
        </Button>
        {garments.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/60 font-sans mt-2">
            {cleanGarmentCount} clean items available from {garments.length} total
          </p>
        )}
        {garments.length === 0 && !loading && (
          <p className="text-center text-xs text-muted-foreground font-sans mt-2">
            Add garments to your closet first to unlock AI styling
          </p>
        )}
      </motion.div>

      {/* Recommendation Result */}
      <AnimatePresence mode="wait">
        {recommendation && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6, ease }}
            className="space-y-4"
          >
            {/* Look Name */}
            <div className="surface-elevated rounded-sm p-5">
              <p className="text-xs tracking-[0.15em] uppercase text-accent font-sans mb-1">Your Look</p>
              <h2 className="text-xl font-serif">{recommendation.outfit_name}</h2>
            </div>

            {/* Pieces */}
            <div className="space-y-2">
              {recommendation.pieces.map((piece, i) => {
                const garment = garments[piece.item_number - 1];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08, ease }}
                    className="surface-elevated rounded-sm p-4 flex items-start gap-3"
                  >
                    {garment?.image_url ? (
                      <img
                        src={garment.image_url}
                        alt={garment.name || "Garment"}
                        className="w-14 h-14 rounded-sm object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-sm bg-muted flex items-center justify-center shrink-0">
                        <ShirtIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-sans font-medium truncate">{garment?.name || `Item ${piece.item_number}`}</p>
                        <span className="tag-pill text-[10px] shrink-0">{piece.role}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-sans leading-relaxed">{piece.reason}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Styling Notes */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3, ease }}
              className="surface-elevated rounded-sm p-4"
            >
              <p className="text-xs tracking-[0.1em] uppercase text-muted-foreground font-sans mb-2">Styling Notes</p>
              <p className="text-sm font-sans leading-relaxed text-secondary-foreground">{recommendation.styling_notes}</p>
            </motion.div>

            {/* Weather Advisory */}
            {recommendation.weather_advisory && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35, ease }}
                className="rounded-sm p-4 bg-[hsl(var(--warning)/0.08)] border border-[hsl(var(--warning)/0.2)]"
              >
                <p className="text-xs font-sans font-medium flex items-center gap-1.5 mb-1">
                  <ThermometerSun className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
                  Weather Advisory
                </p>
                <p className="text-xs font-sans leading-relaxed text-secondary-foreground">{recommendation.weather_advisory}</p>
              </motion.div>
            )}

            {/* Locked Items */}
            {recommendation.locked_items && recommendation.locked_items.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4, ease }}
                className="rounded-sm p-4 bg-[hsl(var(--destructive)/0.05)] border border-[hsl(var(--destructive)/0.15)]"
              >
                <p className="text-xs font-sans font-medium flex items-center gap-1.5 mb-2">
                  <Lock className="w-3.5 h-3.5 text-destructive" />
                  Locked for Today's Weather
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recommendation.locked_items.map((num) => {
                    const g = garments[num - 1];
                    return (
                      <span key={num} className="tag-pill text-[10px] opacity-60 line-through">
                        {g?.name || `Item ${num}`}
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Dust Collectors */}
            {recommendation.dust_collectors && recommendation.dust_collectors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.45, ease }}
                className="rounded-sm p-4 bg-[hsl(var(--success)/0.06)] border border-[hsl(var(--success)/0.15)]"
              >
                <p className="text-xs font-sans font-medium flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                  Dust Collector Revival
                </p>
                <p className="text-xs text-muted-foreground font-sans">
                  These items haven't been worn recently — today's look gives them new life!
                </p>
              </motion.div>
            )}

            {/* Regenerate */}
            <div className="pt-2">
              <Button variant="outline" onClick={generateOutfit} disabled={generating} className="w-full active:scale-[0.98] transition-transform">
                <RefreshCw className={`w-4 h-4 mr-2 ${generating ? "animate-spin" : ""}`} />
                Try Another Look
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
