import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2, Check, Sparkles, ScanLine, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { GarmentCategory, GarmentVibe } from "@/types/aura";
import BatchReviewGrid, { type DetectedGarment } from "@/components/BatchReviewGrid";

interface AITagResult {
  name: string;
  category: GarmentCategory;
  color: string;
  material: string;
  brand: string;
  vibes: GarmentVibe[];
}

type Mode = "choose-mode" | "single" | "batch";
type SingleStep = "choose" | "preview" | "tagging" | "review";
type BatchStep = "capture" | "scanning" | "review";

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mode selection
  const [mode, setMode] = useState<Mode>("choose-mode");

  // --- Single upload state ---
  const [singleStep, setSingleStep] = useState<SingleStep>("choose");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [tags, setTags] = useState<AITagResult | null>(null);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Batch scan state ---
  const [batchStep, setBatchStep] = useState<BatchStep>("capture");
  const [batchImage, setBatchImage] = useState<string | null>(null);
  const [detectedGarments, setDetectedGarments] = useState<DetectedGarment[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);

  const resetAll = () => {
    setMode("choose-mode");
    setSingleStep("choose");
    setBatchStep("capture");
    setImageFile(null);
    setImagePreview(null);
    setTags(null);
    setPrice("");
    setBatchImage(null);
    setDetectedGarments([]);
  };

  // ——— Single Upload Logic ———
  const handleFileSelect = useCallback((file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
      setSingleStep("preview");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleAnalyze = async () => {
    if (!imageFile || !user) return;
    setSingleStep("tagging");
    setLoading(true);
    try {
      const fileExt = imageFile.name.split(".").pop();
      const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      await supabase.storage.from("garment-images").upload(filePath, imageFile);

      const { data: tagData, error: tagError } = await supabase.functions.invoke("tag-garment", {
        body: { imageBase64: imagePreview },
      });

      if (tagError) {
        setTags({ name: "New Garment", category: "tops", color: "Unknown", material: "Unknown", brand: "", vibes: ["casual"] });
      } else {
        setTags(tagData as AITagResult);
      }
      setSingleStep("review");
    } catch (err: any) {
      toast.error("Analysis failed: " + err.message);
      setSingleStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !tags) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).from("garments").insert({
        user_id: user.id,
        image_url: imagePreview || "",
        name: tags.name,
        category: tags.category,
        color: tags.color,
        material: tags.material,
        brand: tags.brand,
        vibes: tags.vibes,
        price: price ? parseFloat(price) : null,
      });
      if (error) throw error;
      toast.success("Garment added to your closet");
      navigate("/");
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ——— Batch Scan Logic ———
  const handleBatchCapture = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setBatchImage(e.target?.result as string);
      setBatchStep("scanning");
      runBatchScan(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const runBatchScan = async (base64: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("scan-closet", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      const garments: DetectedGarment[] = (data.garments || []).map(
        (g: any) => ({
          ...g,
          selected: true,
          position: g.position || { x: 0, y: 0, width: 1, height: 1 },
        })
      );

      if (garments.length === 0) {
        toast.error("No garments detected. Try a clearer photo.");
        setBatchStep("capture");
        return;
      }

      setDetectedGarments(garments);
      setBatchStep("review");
    } catch (err: any) {
      toast.error("Scan failed: " + err.message);
      setBatchStep("capture");
    }
  };

  const handleBatchConfirm = async (selected: DetectedGarment[]) => {
    if (!user || selected.length === 0) return;
    setBatchSaving(true);
    try {
      // Upload the source image once
      const blob = await fetch(batchImage!).then((r) => r.blob());
      const filePath = `${user.id}/${crypto.randomUUID()}.jpg`;
      await supabase.storage.from("garment-images").upload(filePath, blob);
      const { data: urlData } = supabase.storage.from("garment-images").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const rows = selected.map((g) => ({
        user_id: user.id,
        image_url: publicUrl,
        name: g.name,
        category: g.category,
        color: g.color,
        material: g.material,
        brand: g.brand || null,
        vibes: g.vibes,
      }));

      const { error } = await (supabase as any).from("garments").insert(rows);
      if (error) throw error;

      toast.success(`${selected.length} garment${selected.length > 1 ? "s" : ""} added to your closet`);
      navigate("/");
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setBatchSaving(false);
    }
  };

  // ——— Render ———
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
        {/* ——— Mode Selection ——— */}
        {mode === "choose-mode" && (
          <motion.div
            key="mode-select"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-2 gap-3"
          >
            <button
              onClick={() => setMode("single")}
              className="group surface-elevated rounded-sm p-6 flex flex-col items-center gap-3 text-center ring-1 ring-border hover:ring-foreground/20 transition-all active:scale-[0.97]"
            >
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center group-hover:bg-muted transition-colors">
                <Camera className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-sans font-medium">Single Item</p>
                <p className="text-[10px] text-muted-foreground font-sans mt-0.5">
                  Upload one garment
                </p>
              </div>
            </button>

            <button
              onClick={() => setMode("batch")}
              className="group surface-elevated rounded-sm p-6 flex flex-col items-center gap-3 text-center ring-1 ring-border hover:ring-accent/40 transition-all active:scale-[0.97]"
            >
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                <ScanLine className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm font-sans font-medium">Aura Lens</p>
                <p className="text-[10px] text-muted-foreground font-sans mt-0.5">
                  Scan multiple items
                </p>
              </div>
            </button>
          </motion.div>
        )}

        {/* ——— Single: Choose File ——— */}
        {mode === "single" && singleStep === "choose" && (
          <motion.div
            key="single-choose"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
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
            <button onClick={resetAll} className="w-full text-sm text-muted-foreground font-sans hover:text-foreground transition-colors py-3 mt-2">
              ← Back
            </button>
          </motion.div>
        )}

        {/* ——— Single: Preview ——— */}
        {mode === "single" && singleStep === "preview" && imagePreview && (
          <motion.div
            key="single-preview"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div className="aspect-[3/4] rounded-sm overflow-hidden bg-muted">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <Button onClick={handleAnalyze} className="w-full h-12 bg-primary text-primary-foreground active:scale-[0.98] transition-transform">
              <Sparkles className="w-4 h-4 mr-2" />
              Analyze with AI
            </Button>
            <button
              onClick={() => { setSingleStep("choose"); setImagePreview(null); setImageFile(null); }}
              className="w-full text-sm text-muted-foreground font-sans hover:text-foreground transition-colors py-2"
            >
              Choose a different photo
            </button>
          </motion.div>
        )}

        {/* ——— Single: Tagging ——— */}
        {mode === "single" && singleStep === "tagging" && (
          <motion.div
            key="single-tagging"
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

        {/* ——— Single: Review ——— */}
        {mode === "single" && singleStep === "review" && tags && (
          <motion.div
            key="single-review"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {imagePreview && (
              <div className="w-32 h-40 rounded-sm overflow-hidden bg-muted mx-auto">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
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
              <div>
                <p className="text-xs text-muted-foreground font-sans mb-2 uppercase tracking-wider">Vibes</p>
                <div className="flex gap-1.5 flex-wrap">
                  {tags.vibes.map((vibe) => (
                    <span key={vibe} className="tag-pill">{vibe.replace("_", " ")}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-sans mb-2 uppercase tracking-wider">Price (optional)</p>
                <Input type="number" step="0.01" placeholder="$0.00" value={price} onChange={(e) => setPrice(e.target.value)} className="h-10 bg-background border-border" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={loading} className="w-full h-12 bg-primary text-primary-foreground active:scale-[0.98] transition-transform">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" />Add to Closet</>}
            </Button>
          </motion.div>
        )}

        {/* ——— Batch: Capture ——— */}
        {mode === "batch" && batchStep === "capture" && (
          <motion.div
            key="batch-capture"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="border-2 border-dashed border-accent/30 rounded-sm aspect-[4/3] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-accent/50 transition-colors group bg-accent/[0.03]"
              onClick={() => document.getElementById("batch-input")?.click()}
            >
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                <ScanLine className="w-7 h-7 text-accent" />
              </div>
              <div className="text-center px-6">
                <p className="text-sm font-sans font-medium">Snap your rack or flat-lay</p>
                <p className="text-xs text-muted-foreground font-sans mt-1">
                  AI will detect and tag each garment individually
                </p>
              </div>
            </div>
            <input
              id="batch-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBatchCapture(file);
              }}
            />
            <button onClick={resetAll} className="w-full text-sm text-muted-foreground font-sans hover:text-foreground transition-colors py-3 mt-2">
              ← Back
            </button>
          </motion.div>
        )}

        {/* ——— Batch: Scanning ——— */}
        {mode === "batch" && batchStep === "scanning" && (
          <motion.div
            key="batch-scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                <ScanLine className="w-7 h-7 text-accent" />
              </div>
              <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-accent/30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-sans font-medium">Scanning your closet</p>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                Detecting garments, tagging vibes & categories...
              </p>
            </div>
          </motion.div>
        )}

        {/* ——— Batch: Review ——— */}
        {mode === "batch" && batchStep === "review" && batchImage && (
          <BatchReviewGrid
            key="batch-review"
            garments={detectedGarments}
            sourceImage={batchImage}
            onConfirm={handleBatchConfirm}
            onBack={() => {
              setBatchStep("capture");
              setBatchImage(null);
              setDetectedGarments([]);
            }}
            saving={batchSaving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TagField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-sans mb-1 uppercase tracking-wider">{label}</p>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm bg-background border-border" />
    </div>
  );
}
