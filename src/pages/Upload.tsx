import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2, Check, Sparkles, ScanLine, Upload as UploadIcon, RotateCcw, X, Image as ImageIcon, Smartphone, Receipt } from "lucide-react";
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

type Mode = "choose-mode" | "single" | "batch" | "screenshot";
type SingleStep = "choose" | "preview" | "tagging" | "mannequin" | "review";
type ScreenshotStep = "choose" | "extracting" | "review";
type BatchStep = "viewfinder" | "scanning" | "review";

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("choose-mode");

  // --- Single upload state ---
  const [singleStep, setSingleStep] = useState<SingleStep>("choose");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [tags, setTags] = useState<AITagResult | null>(null);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Batch scan state ---
  const [batchStep, setBatchStep] = useState<BatchStep>("viewfinder");
  const [batchImage, setBatchImage] = useState<string | null>(null);
  const [detectedGarments, setDetectedGarments] = useState<DetectedGarment[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);

  // --- Screenshot sync state ---
  const [screenshotStep, setScreenshotStep] = useState<ScreenshotStep>("choose");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotTags, setScreenshotTags] = useState<(AITagResult & { price?: number; description?: string }) | null>(null);
  // --- Camera state ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const resetAll = () => {
    stopCamera();
    setMode("choose-mode");
    setSingleStep("choose");
    setBatchStep("viewfinder");
    setScreenshotStep("choose");
    setImageFile(null);
    setImagePreview(null);
    setProcessedImage(null);
    setTags(null);
    setPrice("");
    setBatchImage(null);
    setDetectedGarments([]);
    setScreenshotPreview(null);
    setScreenshotTags(null);
  };

  // ——— Camera Logic ———
  const startCamera = useCallback(async () => {
    setCameraError(false);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch {
      console.log("Camera not available, falling back to file upload");
      setCameraError(true);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  // Start camera when entering batch viewfinder
  useEffect(() => {
    if (mode === "batch" && batchStep === "viewfinder") {
      startCamera();
    }
    return () => {
      if (mode !== "batch" || batchStep !== "viewfinder") {
        // Don't stop on cleanup if still in viewfinder
      }
    };
  }, [mode, batchStep, startCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

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

      // Ghost Mannequin step
      setSingleStep("mannequin");
      try {
        const { data: mannequinData, error: mannequinError } = await supabase.functions.invoke("ghost-mannequin", {
          body: { imageBase64: imagePreview, garmentName: (tagData as AITagResult)?.name || "garment" },
        });

        if (!mannequinError && mannequinData?.imageBase64) {
          setProcessedImage(mannequinData.imageBase64);
        } else {
          // Fallback: use original image
          setProcessedImage(null);
        }
      } catch {
        setProcessedImage(null);
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
      let finalImageUrl = imagePreview || "";

      // If we have a ghost mannequin image, upload it to storage
      if (processedImage) {
        const blob = await fetch(processedImage).then((r) => r.blob());
        const filePath = `${user.id}/${crypto.randomUUID()}.png`;
        await supabase.storage.from("garment-images").upload(filePath, blob, { contentType: "image/png" });
        const { data: urlData } = supabase.storage.from("garment-images").getPublicUrl(filePath);
        finalImageUrl = urlData.publicUrl;
      }

      const { error } = await (supabase as any).from("garments").insert({
        user_id: user.id,
        image_url: finalImageUrl,
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
  const handleBatchCapture = useCallback((imageData: string) => {
    stopCamera();
    setBatchImage(imageData);
    setBatchStep("scanning");
    runBatchScan(imageData);
  }, [stopCamera]);

  const handleBatchFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setBatchImage(base64);
      setBatchStep("scanning");
      runBatchScan(base64);
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
        setBatchStep("viewfinder");
        startCamera();
        return;
      }

      setDetectedGarments(garments);
      setBatchStep("review");
    } catch (err: any) {
      toast.error("Scan failed: " + err.message);
      setBatchStep("viewfinder");
      startCamera();
    }
  };

  const handleBatchConfirm = async (selected: DetectedGarment[]) => {
    if (!user || selected.length === 0) return;
    setBatchSaving(true);
    try {
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

  const handleShutterPress = () => {
    const frame = captureFrame();
    if (frame) {
      handleBatchCapture(frame);
    }
  };

  // ——— Render ———
  return (
    <div className={mode === "batch" && batchStep === "viewfinder" ? "" : "max-w-lg mx-auto"}>
      <canvas ref={canvasRef} className="hidden" />

      {/* Only show header when not in viewfinder */}
      {!(mode === "batch" && batchStep === "viewfinder" && !cameraError) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-1 font-sans">Smart Upload</p>
          <h1 className="text-3xl">Add to Closet</h1>
        </motion.div>
      )}

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
                <p className="text-[10px] text-muted-foreground font-sans mt-0.5">Upload one garment</p>
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
                <p className="text-[10px] text-muted-foreground font-sans mt-0.5">Live camera scan</p>
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

        {/* ——— Single: Ghost Mannequin Processing ——— */}
        {mode === "single" && singleStep === "mannequin" && (
          <motion.div
            key="single-mannequin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-accent" />
              </div>
              <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-accent/30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-sans font-medium">Creating ghost mannequin</p>
              <p className="text-xs text-muted-foreground font-sans mt-1">Generating professional product photo...</p>
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
            <div className="flex gap-3 items-start mx-auto w-fit">
              {/* Show processed ghost mannequin image */}
              <div className="w-32 h-40 rounded-sm overflow-hidden bg-white border border-border flex items-center justify-center">
                <img
                  src={processedImage || imagePreview || ""}
                  alt="Ghost mannequin"
                  className="w-full h-full object-contain"
                />
              </div>
              {/* Show original for comparison if we have a processed version */}
              {processedImage && imagePreview && (
                <div className="w-20 h-26 rounded-sm overflow-hidden bg-muted opacity-60 relative">
                  <img src={imagePreview} alt="Original" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0.5 left-0.5 text-[8px] font-sans bg-background/80 px-1 rounded">Original</span>
                </div>
              )}
            </div>
            <div className="surface-elevated rounded-sm p-5 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-green-600" />
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

        {/* ——— Batch: Live Camera Viewfinder ——— */}
        {mode === "batch" && batchStep === "viewfinder" && (
          <motion.div
            key="batch-viewfinder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={cameraError ? "max-w-lg mx-auto" : "fixed inset-0 z-50 bg-black flex flex-col"}
          >
            {!cameraError ? (
              <>
                {/* Camera feed */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Overlay UI */}
                <div className="absolute inset-0 flex flex-col pointer-events-none">
                  {/* Top bar */}
                  <div className="flex items-center justify-between p-4 pt-12 pointer-events-auto">
                    <button
                      onClick={resetAll}
                      className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition-transform"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <ScanLine className="w-4 h-4 text-white" />
                      <span className="text-white text-sm font-sans font-medium tracking-wide">Aura Lens</span>
                    </div>
                    <div className="w-10" />
                  </div>

                  {/* Center scan guide */}
                  <div className="flex-1 flex items-center justify-center">
                    {cameraReady && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        className="text-center"
                      >
                        <p className="text-white/70 text-xs font-sans tracking-wide">Point at your clothing rack</p>
                      </motion.div>
                    )}
                    {!cameraReady && (
                      <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                    )}
                  </div>

                  {/* Bottom controls */}
                  <div className="pb-12 pt-6 flex flex-col items-center gap-4 pointer-events-auto">
                    {/* Shutter button */}
                    <button
                      onClick={handleShutterPress}
                      disabled={!cameraReady}
                      className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30"
                    >
                      <div className="w-[58px] h-[58px] rounded-full bg-white" />
                    </button>
                    {/* File upload fallback */}
                    <button
                      onClick={() => document.getElementById("batch-file-input")?.click()}
                      className="text-white/60 text-xs font-sans hover:text-white/90 transition-colors"
                    >
                      Or upload from gallery
                    </button>
                  </div>
                </div>

                <input
                  id="batch-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBatchFileUpload(file);
                  }}
                />
              </>
            ) : (
              /* Desktop fallback: file upload */
              <div>
                <div
                  className="border-2 border-dashed border-accent/30 rounded-sm aspect-[4/3] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-accent/50 transition-colors group bg-accent/[0.03]"
                  onClick={() => document.getElementById("batch-fallback-input")?.click()}
                >
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                    <ScanLine className="w-7 h-7 text-accent" />
                  </div>
                  <div className="text-center px-6">
                    <p className="text-sm font-sans font-medium">Upload a photo of your rack or flat-lay</p>
                    <p className="text-xs text-muted-foreground font-sans mt-1">
                      Camera not available — upload an image instead
                    </p>
                  </div>
                </div>
                <input
                  id="batch-fallback-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBatchFileUpload(file);
                  }}
                />
                <button onClick={resetAll} className="w-full text-sm text-muted-foreground font-sans hover:text-foreground transition-colors py-3 mt-2">
                  ← Back
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ——— Batch: Scanning ——— */}
        {mode === "batch" && batchStep === "scanning" && (
          <motion.div
            key="batch-scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4 max-w-lg mx-auto"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                <ScanLine className="w-7 h-7 text-accent" />
              </div>
              <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-accent/30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-sans font-medium">Scanning your closet</p>
              <p className="text-xs text-muted-foreground font-sans mt-1">Detecting garments, tagging vibes & categories...</p>
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
              setBatchStep("viewfinder");
              setBatchImage(null);
              setDetectedGarments([]);
              startCamera();
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
