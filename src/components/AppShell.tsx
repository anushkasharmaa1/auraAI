import { motion } from "framer-motion";
import { Plus, Shirt, LayoutGrid, Sparkles, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { icon: LayoutGrid, label: "Closet", path: "/" },
  { icon: Plus, label: "Add", path: "/upload" },
  { icon: Sparkles, label: "Stylist", path: "/stylist" },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2">
            <Shirt className="w-5 h-5" />
            <span className="font-serif text-xl tracking-tight">Aura</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-2 px-4 py-2 text-sm font-sans transition-colors rounded-sm ${
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-secondary rounded-sm -z-10"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground transition-colors p-2"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container py-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/90 backdrop-blur-sm border-t border-border">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs font-sans transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-accent" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
