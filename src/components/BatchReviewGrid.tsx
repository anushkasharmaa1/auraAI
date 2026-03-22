import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GarmentCategory, GarmentVibe } from "@/types/aura";

export interface DetectedGarment {
  name: string;
  category: GarmentCategory;
  color: string;
  material: string;
  brand: string;
  vibes: GarmentVibe[];
  position: { x: number; y: number; width: number; height: number };
  selected: boolean;
}

interface BatchReviewGridProps {
  garments: DetectedGarment[];
  sourceImage: string;
  onConfirm: (selected: DetectedGarment[]) => void;
  onBack: () => void;
  saving: boolean;
}

export default function BatchReviewGrid({
  garments,
  sourceImage,
  onConfirm,
  onBack,
  saving,
}: BatchReviewGridProps) {
  const [items, setItems] = useState<DetectedGarment[]>(garments);

  const toggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((g, i) => (i === index ? { ...g, selected: !g.selected } : g))
    );
  };

  const toggleAll = () => {
    const allSelected = items.every((g) => g.selected);
    setItems((prev) => prev.map((g) => ({ ...g, selected: !allSelected })));
  };

  const selectedCount = items.filter((g) => g.selected).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-accent" />
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-sans">
              Aura Lens
            </p>
          </div>
          <p className="text-sm font-sans font-medium">
            {items.length} garment{items.length !== 1 ? "s" : ""} detected
          </p>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs font-sans text-muted-foreground hover:text-foreground transition-colors active:scale-[0.97]"
        >
          {items.every((g) => g.selected) ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        <AnimatePresence>
          {items.map((garment, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: index * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={() => toggleItem(index)}
              className={`relative rounded-sm overflow-hidden text-left transition-shadow active:scale-[0.97] ${
                garment.selected
                  ? "ring-2 ring-accent shadow-md"
                  : "ring-1 ring-border shadow-sm"
              }`}
            >
              {/* Cropped region from source image */}
              <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                <img
                  src={sourceImage}
                  alt={garment.name}
                  className="absolute"
                  style={{
                    left: `${-garment.position.x * 100}%`,
                    top: `${-garment.position.y * 100}%`,
                    width: `${100 / garment.position.width}%`,
                    height: `${100 / garment.position.height}%`,
                    objectFit: "cover",
                  }}
                />

                {/* Selection badge */}
                <div className="absolute top-2 right-2">
                  {garment.selected ? (
                    <CheckCircle2 className="w-5 h-5 text-accent drop-shadow-sm" />
                  ) : (
                    <Circle className="w-5 h-5 text-foreground/30" />
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-2.5 space-y-1">
                <p className="text-xs font-sans font-medium leading-tight truncate">
                  {garment.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                    {garment.category}
                  </span>
                  <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40" />
                  <span className="text-[10px] font-sans text-muted-foreground">
                    {garment.color}
                  </span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {garment.vibes.slice(0, 2).map((v) => (
                    <span
                      key={v}
                      className="text-[9px] font-sans px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                    >
                      {v.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <Button
          onClick={() => onConfirm(items.filter((g) => g.selected))}
          disabled={selectedCount === 0 || saving}
          className="w-full h-12 bg-primary text-primary-foreground active:scale-[0.98] transition-transform"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Add {selectedCount} item{selectedCount !== 1 ? "s" : ""} to Closet
            </>
          )}
        </Button>
        <button
          onClick={onBack}
          disabled={saving}
          className="w-full text-sm text-muted-foreground font-sans hover:text-foreground transition-colors py-2"
        >
          Scan again
        </button>
      </div>
    </motion.div>
  );
}
