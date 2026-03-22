import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Garment, GarmentVibe } from "@/types/aura";
import { MoreHorizontal, Shirt, Droplets } from "lucide-react";

interface GarmentCardProps {
  garment: Garment;
  onUpdate: () => void;
}

export default function GarmentCard({ garment, onUpdate }: GarmentCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const costPerWear = garment.price && garment.wear_count > 0
    ? (garment.price / garment.wear_count).toFixed(2)
    : null;

  const handleWear = async () => {
    await (supabase as any)
      .from("garments")
      .update({
        wear_count: garment.wear_count + 1,
        last_worn_at: new Date().toISOString(),
        laundry_status: "dirty",
      })
      .eq("id", garment.id);
    onUpdate();
    setShowMenu(false);
  };

  const handleClean = async () => {
    await supabase
      .from("garments")
      .update({ laundry_status: "clean" } as any)
      .eq("id", garment.id);
    onUpdate();
    setShowMenu(false);
  };

  const isDirty = garment.laundry_status === "dirty";

  return (
    <div className={`garment-card group relative ${isDirty ? "opacity-60" : ""}`}>
      {/* Image */}
      <div className="aspect-[3/4] bg-muted relative overflow-hidden">
        {garment.image_url ? (
          <img
            src={garment.image_url}
            alt={garment.name || "Garment"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Shirt className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}

        {isDirty && (
          <div className="absolute top-2 left-2 bg-foreground/80 text-primary-foreground rounded-sm px-2 py-0.5 text-[10px] tracking-wider uppercase font-sans flex items-center gap-1">
            <Droplets className="w-3 h-3" />
            Laundry
          </div>
        )}

        {/* Menu button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="absolute top-2 right-2 p-1.5 rounded-sm bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Quick actions */}
        {showMenu && (
          <div className="absolute top-10 right-2 bg-background border border-border rounded-sm shadow-lg py-1 min-w-[140px] z-10">
            <button
              onClick={handleWear}
              className="w-full text-left px-3 py-2 text-sm font-sans hover:bg-secondary transition-colors"
            >
              Mark as worn
            </button>
            <button
              onClick={handleClean}
              className="w-full text-left px-3 py-2 text-sm font-sans hover:bg-secondary transition-colors"
            >
              Mark as clean
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="text-sm font-sans font-medium truncate">
          {garment.name || "Untitled"}
        </p>
        <div className="flex items-center gap-2">
          {garment.brand && (
            <span className="text-xs text-muted-foreground font-sans">{garment.brand}</span>
          )}
          {garment.color && (
            <span className="text-xs text-muted-foreground font-sans">· {garment.color}</span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground font-sans">
            Worn {garment.wear_count}×
          </span>
          {costPerWear && (
            <span className="text-[11px] text-accent font-sans font-medium">
              ${costPerWear}/wear
            </span>
          )}
        </div>

        {/* Vibes */}
        {garment.vibes && garment.vibes.length > 0 && (
          <div className="flex gap-1 flex-wrap pt-1">
            {garment.vibes.slice(0, 2).map((vibe) => (
              <span key={vibe} className="tag-pill text-[10px]">
                {vibe.replace("_", " ")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
