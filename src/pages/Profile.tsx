import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { User, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const { user, signOut } = useAuth();

  return (
    <div className="max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-1 font-sans">Account</p>
        <h1 className="text-3xl">Profile</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4"
      >
        <div className="surface-elevated rounded-sm p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-sans font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground font-sans">
                Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "recently"}
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={signOut}
          className="w-full h-11 active:scale-[0.98] transition-transform"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </motion.div>
    </div>
  );
}
