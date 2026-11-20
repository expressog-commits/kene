"use client";

import { cn } from "./ui";

/** Capsule de médicament en relief, à incliner via des classes de rotation. */
export function Capsule3D({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-full bg-gradient-to-br from-brand-300 via-brand-500 to-brand-700",
        "shadow-[0_26px_50px_-16px_rgba(11,126,114,0.75)]",
        className,
      )}
    >
      <span className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-br from-white via-slate-100 to-slate-300" />
      <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/45 to-transparent" />
      <span className="absolute left-2 top-2 h-1/3 w-1/3 rounded-full bg-white/45 blur-md" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-ink-900/10" />
    </div>
  );
}

/** Halo décoratif flou. */
export function GlowOrb({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "sun" | "white";
}) {
  const tones = {
    brand: "bg-brand-400/35",
    sun: "bg-sun-400/30",
    white: "bg-white/30",
  } as const;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute rounded-full blur-3xl", tones[tone], className)}
    />
  );
}

/** Plateau isométrique de lits d'urgence, avec lits libres / tendus / occupés. */
export function BedGrid3D({ className }: { className?: string }) {
  const beds: ("free" | "tension" | "full")[] = [
    "free",
    "full",
    "tension",
    "free",
    "full",
    "free",
    "free",
    "full",
    "tension",
    "free",
    "free",
    "full",
    "free",
    "tension",
    "full",
    "free",
    "free",
    "full",
    "tension",
    "free",
  ];

  const tones = {
    free: "from-brand-200 to-brand-500 shadow-[0_8px_14px_-6px_rgba(11,126,114,0.9)]",
    tension: "from-sun-200 to-sun-500 shadow-[0_8px_14px_-6px_rgba(217,139,18,0.9)]",
    full: "from-slate-500/80 to-slate-700/80 shadow-[0_8px_14px_-6px_rgba(0,0,0,0.8)]",
  } as const;

  return (
    <div
      aria-hidden
      className={cn("relative flex items-center justify-center [perspective:1100px]", className)}
    >
      <div className="absolute h-40 w-64 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="float-y [transform-style:preserve-3d]">
        <div className="[transform:rotateX(56deg)_rotateZ(-32deg)] [transform-style:preserve-3d]">
          <div className="grid grid-cols-5 gap-2 rounded-2xl border border-white/20 bg-white/[0.06] p-3 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-sm">
            {beds.map((bed, index) => (
              <div
                key={index}
                className={cn(
                  "relative h-6 w-11 rounded-[5px] bg-gradient-to-br",
                  tones[bed],
                )}
              >
                <span className="absolute left-1 top-1 h-1.5 w-3 rounded-full bg-white/75" />
                <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-b-[5px] bg-ink-900/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Petite étiquette flottante en verre dépoli. */
export function GlassChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/70 bg-white/80 px-3 py-2 shadow-[0_18px_35px_-20px_rgba(11,31,29,0.6)] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}
