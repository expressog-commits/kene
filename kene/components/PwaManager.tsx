"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaSnapshot {
  canInstall: boolean;
  isInstalled: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedFlag = false;
const listeners = new Set<() => void>();

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)").matches;
  const safariStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return standaloneMedia || safariStandalone;
}

function emitPwaChange() {
  for (const listener of listeners) listener();
}

export function getPwaSnapshot(): PwaSnapshot {
  return {
    canInstall: deferredPrompt !== null && !installedFlag && !detectStandalone(),
    isInstalled: installedFlag || detectStandalone(),
  };
}

export function subscribePwa(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function triggerPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  emitPwaChange();
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      installedFlag = true;
      emitPwaChange();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default function PwaManager() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    if (detectStandalone()) {
      installedFlag = true;
      emitPwaChange();
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      emitPwaChange();
    };

    const onInstalled = () => {
      deferredPrompt = null;
      installedFlag = true;
      emitPwaChange();
    };

    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[70] rounded-xl border border-sun-300 bg-sun-50 px-3.5 py-2 text-xs font-medium text-sun-900 shadow-lift"
    >
      Connexion perdue — mode hors-ligne actif
    </div>
  );
}
