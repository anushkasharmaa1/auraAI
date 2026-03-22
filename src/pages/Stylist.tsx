import { motion } from "framer-motion";
import { Sparkles, Cloud, Calendar } from "lucide-react";

export default function StylistPage() {
  return (
    <div className="max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-1 font-sans">AI Powered</p>
        <h1 className="text-3xl">Your Stylist</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4"
      >
        {/* Coming soon cards */}
        {[
          { icon: Sparkles, title: "Daily Outfit", desc: "AI picks based on weather, calendar & your style preferences" },
          { icon: Cloud, title: "Weather Aware", desc: "Locks out heavy coats on warm days, surfaces rain-ready pieces" },
          { icon: Calendar, title: "Occasion Mode", desc: "Tell it about your day — meeting, date, gym — get a curated look" },
        ].map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="surface-elevated rounded-sm p-5 flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-sm bg-secondary flex items-center justify-center shrink-0">
              <feature.icon className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-sans font-medium mb-0.5">{feature.title}</p>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">{feature.desc}</p>
            </div>
          </motion.div>
        ))}

        <p className="text-center text-xs text-muted-foreground/50 font-sans pt-4">
          Add 5+ garments to unlock AI styling recommendations
        </p>
      </motion.div>
    </div>
  );
}
