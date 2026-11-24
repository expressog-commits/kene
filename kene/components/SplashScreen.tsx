"use client";

import { useEffect, useState } from "react";
import { IconLogo } from "./icons";
import { cn } from "./ui";

const SPLASH_KEY = "kene-splash-seen";

export default function SplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "show" | "fade">("hidden");

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SPLASH_KEY)) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.sessionStorage.setItem(SPLASH_KEY, "1");
        return;
      }
    } catch {
      return;
    }

    setPhase("show");

    const fadeTimer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        // Ignore storage write restriction.
      }
      setPhase("fade");
    }, 550);

    const hideTimer = window.setTimeout(() => {
      setPhase("hidden");
    }, 850);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-300",
        phase === "fade" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <div
        className={cn(
          "transition-transform duration-300",
          phase === "fade" ? "scale-95" : "scale-100",
        )}
      >
        <IconLogo className="h-24 w-24 text-brand-700" />
      </div>
    </div>
  );
}
