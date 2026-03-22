import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Garment, GarmentCategory } from "@/types/aura";
import GarmentCard from "@/components/GarmentCard";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";

const categories: (GarmentCategory | "all")[] = ["all", "tops", "bottoms", "outerwear", "dresses", "shoes", "accessories", "bags", "activewear"];

export default function ClosetPage() {
  const { user } = useAuth();
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<GarmentCategory | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchGarments();
  }, [user]);

  const fetchGarments = async () => {
    const { data, error } = await supabase
      .from("garments")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setGarments(data as unknown as Garment[]);
    }
    setLoading(false);
  };

  const filtered = garments.filter((g) => {
    const matchesCategory = activeCategory === "all" || g.category === activeCategory;
    const matchesSearch = !search || 
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      g.brand?.toLowerCase().includes(search.toLowerCase()) ||
      g.color?.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6"
      >
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-1 font-sans">Your Wardrobe</p>
        <h1 className="text-3xl md:text-4xl">Digital Closet</h1>
      </motion.div>

      {/* Search & filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 space-y-4"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search your closet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-foreground"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`tag-pill whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <p className="text-muted-foreground font-sans mb-1">
            {garments.length === 0 ? "Your closet is empty" : "No items match your search"}
          </p>
          {garments.length === 0 && (
            <p className="text-sm text-muted-foreground/60 font-sans">
              Tap the + button to add your first garment
            </p>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((garment, i) => (
              <motion.div
                key={garment.id}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                layout
              >
                <GarmentCard garment={garment} onUpdate={fetchGarments} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Stats bar */}
      {garments.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 flex items-center gap-6 text-xs text-muted-foreground font-sans"
        >
          <span>{garments.length} items</span>
          <span>{garments.filter(g => g.laundry_status === 'clean').length} clean</span>
          <span>{garments.filter(g => g.laundry_status === 'dirty').length} in laundry</span>
        </motion.div>
      )}
    </div>
  );
}
