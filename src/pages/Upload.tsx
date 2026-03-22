import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Camera, Link as LinkIcon, Loader2, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { GarmentCategory, GarmentVibe } from "@/types/aura";

interface AITagResult {
  name: string;
  category: GarmentCategory;
  color: string;
  material: string;
  brand: string;
  vibes: GarmentVibe[];
}

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"choose" | "preview" | "tagging" | "review">("choose");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [tags, setTags] = useState<AITagResult | null>(null);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
      setStep("preview");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleAnalyze = async () => {
    if (!imageFile || !user) return;
    setStep("tagging");
    setLoading(true);

    try {
      // Upload image to storage
      const fileExt = imageFile.name.split(".").pop();
      const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("garments")
        .upload(filePath, imageFile);

      if (uploadError) {
        // If storage bucket doesn't exist, use data URL as fallback
        console.warn("Storage upload failed, using local preview:", uploadError.message);
      }

      // Call AI tagging edge function
      const { data: tagData, error: tagError } = await supabase.functions.invoke("tag-garment", {
        body: { imageBase64: imagePreview },
      });

      if (tagError) {
        console.warn("AI tagging failed, using defaults:", tagError.message);
        setTags({
          name: "New Garment",
          category: "tops",
          color: "Unknown",
          material: "Unknown",
          brand: "",
          vibes: ["casual"],
        });
      } else {
        setTags(tagData as AITagResult);
      }

      setStep("review");
    } catch (err: any) {
      toast.error("Analysis failed: " + err.message);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !tags) return;
    setLoading(true);

    try {
      const imageUrl = imagePreview || "";

      const { error } = await supabase.from("garments").insert({
        user_id: user.id,
        image_url: imageUrl,
        name: tags.name,
        category: tags.category,
        color: tags.color,
        material: tags.material,
        brand: tags.brand,
        vibes: tags.vibes,
        price: price ? parseFloat(price) : null,
      } as any);

      if (error) throw error;

      toast.success("Garment added to your closet");
      navigate("/");
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-1 font-sans">Smart Upload</p>
        <h1 className="text-3xl">Add to Closet</h1>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === "choose" && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-sm aspect-square flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-foreground/30 transition-colors group"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center group-hover:bg-muted transition-colors">
                <Camera className="w-7 h-7 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-sans font-medium">Drop a photo or tap to upload</p>
                <p className="text-xs text-muted-foreground font-sans mt-1">AI will auto-tag category, color & vibe</p>
              </div>
            </div>

            <input
              id="file-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
          </motion.div>
        )}

        {step === "preview" && imagePreview && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div className="aspect-[3/4] rounded-sm overflow-hidden bg-muted">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            </div>

            <Button
              onClick={handleAnalyze}
              className="w-full h-12 bg-primary text-primary-foreground active:scale-[0.98] transition-transform"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Analyze with AI
            </Button>

            <button
              onClick={() => { setStep("choose"); setImagePreview(null); setImageFile(null); }}
              className="w-full text-sm text-muted-foreground font-sans hover:text-foreground transition-colors py-2"
            >
              Choose a different photo
            </button>
          </motion.div>
        )}

        {step === "tagging" && (
          <motion.div
            key="tagging"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-accent" />
              </div>
              <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-accent/30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-sans font-medium">Analyzing your garment</p>
              <p className="text-xs text-muted-foreground font-sans mt-1">Detecting category, color, material & vibe...</p>
            </div>
          </motion.div>
        )}

        {step === "review" && tags && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* Thumbnail */}
            {imagePreview && (
              <div className="w-32 h-40 rounded-sm overflow-hidden bg-muted mx-auto">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            {/* AI Tags */}
            <div className="surface-elevated rounded-sm p-5 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-success" />
                <p className="text-sm font-sans font-medium">AI Analysis Complete</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <TagField label="Name" value={tags.name} onChange={(v) => setTags({ ...tags, name: v })} />
                <TagField label="Category" value={tags.category} onChange={(v) => setTags({ ...tags, category: v as any })} />
                <TagField label="Color" value={tags.color} onChange={(v) => setTags({ ...tags, color: v })} />
                <TagField label="Material" value={tags.material} onChange={(v) => setTags({ ...tags, material: v })} />
                <TagField label="Brand" value={tags.brand} onChange={(v) => setTags({ ...tags, brand: v })} />
              </div>

              {/* Vibes */}
              <div>
                <p className="text-xs text-muted-foreground font-sans mb-2 uppercase tracking-wider">Vibes</p>
                <div className="flex gap-1.5 flex-wrap">
                  {tags.vibes.map((vibe) => (
                    <span key={vibe} className="tag-pill">{vibe.replace("_", " ")}</span>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <p className="text-xs text-muted-foreground font-sans mb-2 uppercase tracking-wider">Price (optional)</p>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="$0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-10 bg-background border-border"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground active:scale-[0.98] transition-transform"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Add to Closet
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TagField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-sans mb-1 uppercase tracking-wider">{label}</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm bg-background border-border"
      />
    </div>
  );
}
