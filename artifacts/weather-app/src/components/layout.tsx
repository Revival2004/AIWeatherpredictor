import React from "react";
import { Link, useLocation } from "wouter";
import { CloudRain, Compass, LineChart, History } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Compass },
    { href: "/history", label: "History Log", icon: History },
    { href: "/stats", label: "Analytics", icon: LineChart },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <aside className="w-full md:w-64 md:flex-shrink-0 border-b md:border-r border-border/50 bg-card/30 backdrop-blur-md flex flex-col z-10 sticky top-0 md:h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
            <CloudRain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">Microclimate</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">AI Predictor</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 pb-6 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>
      
      <main className="flex-1 relative z-0">
        {children}
      </main>
    </div>
  );
}
