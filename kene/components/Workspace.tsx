"use client";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "./store";
import { IconArrowLeft, IconLogo, IconSettings } from "./icons";
import SplashScreen from "./SplashScreen";
import Search from "./views/Search";
import Emergency from "./views/Emergency";
import PharmacyView from "./views/PharmacyView";
import SettingsView from "./views/SettingsView";
import HospitalView from "./views/HospitalView";
import ProfessionalAuth from "./views/ProfessionalAuth";
import { FEATURES } from "@/lib/features";

type SpaceKey = "home" | "settings" | "account" | "emergency" | "hospital";

interface ParsedRoute {
  space: SpaceKey;
  onlyDutyFromUrl: boolean;
}

function parseRoute(raw: string | null): ParsedRoute {
  switch (raw) {
    case "duty":
      return { space: "home", onlyDutyFromUrl: true };
    case "settings":
      return { space: "settings", onlyDutyFromUrl: false };
    case "pharmacy":
    case "account":
      return { space: "account", onlyDutyFromUrl: false };
    case "emergency":
      return FEATURES.hospitals
        ? { space: "emergency", onlyDutyFromUrl: false }
        : { space: "home", onlyDutyFromUrl: false };
    case "hospital":
      return FEATURES.hospitals
        ? { space: "hospital", onlyDutyFromUrl: false }
        : { space: "home", onlyDutyFromUrl: false };
    case "search":
    default:
      return { space: "home", onlyDutyFromUrl: false };
  }
}

export default function Workspace() {
  const {
    session,
    recoveryCode,
    dismissRecoveryCode,
    saving,
    isOffline,
    canInstallPwa,
    installPwa,
    toast,
    notify,
  } = useStore();

  const [space, setSpace] = useState<SpaceKey>("home");
  const [initialQuery, setInitialQuery] = useState("");
  const [initialOnlyDuty, setInitialOnlyDuty] = useState(false);
  const [initialTriggerGps, setInitialTriggerGps] = useState(false);

  const consumeInitialQuery = useCallback(() => {
    setInitialQuery("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("q")) {
        url.searchParams.delete("q");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, []);

  const consumeInitialOnlyDuty = useCallback(() => {
    setInitialOnlyDuty(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("view") === "duty") {
        url.searchParams.delete("view");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, []);

  const consumeInitialTriggerGps = useCallback(() => {
    setInitialTriggerGps(false);
  }, []);

  const selectSpace = useCallback((next: SpaceKey) => {
    const target: SpaceKey =
      !FEATURES.hospitals && (next === "emergency" || next === "hospital")
        ? "home"
        : next;
    setSpace(target);
    setInitialQuery("");
    setInitialOnlyDuty(false);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("q");
      if (target === "home") {
        url.searchParams.delete("view");
      } else if (target === "account") {
        url.searchParams.set("view", "pharmacy");
      } else {
        url.searchParams.set("view", target);
      }
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const parsed = parseRoute(params.get("view"));
      setSpace(parsed.space);
      setInitialOnlyDuty(parsed.onlyDutyFromUrl);
      setInitialQuery(params.get("q")?.trim() ?? "");
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const activeSpace: SpaceKey =
    !FEATURES.hospitals && (space === "emergency" || space === "hospital")
      ? "home"
      : space;

  return (
    <>
      <SplashScreen />

      <div id="contenu" tabIndex={-1} aria-busy={saving} className="min-h-screen focus:outline-none">
        {activeSpace === "home" ? (
          <Search
            initialQuery={initialQuery}
            onConsumeInitialQuery={consumeInitialQuery}
            initialOnlyDuty={initialOnlyDuty}
            onConsumeInitialOnlyDuty={consumeInitialOnlyDuty}
            initialTriggerGps={initialTriggerGps}
            onConsumeInitialTriggerGps={consumeInitialTriggerGps}
            onOpenSettings={() => selectSpace("settings")}
            onOpenAccount={() => selectSpace("account")}
            accountLabel={
              session?.type === "pharmacy" ? session.establishmentName : null
            }
            isOffline={isOffline}
            saving={saving}
            canInstallPwa={canInstallPwa}
            onInstallPwa={() => {
              void installPwa();
            }}
          />
        ) : null}

        {activeSpace === "settings" ? (
          <SettingsView
            onBack={() => selectSpace("home")}
            onOpenAccount={() => selectSpace("account")}
            onFindNearby={() => {
              setInitialTriggerGps(true);
              selectSpace("home");
            }}
          />
        ) : null}

        {activeSpace === "account" ? (
          session?.type === "pharmacy" ? (
            <div className="min-h-screen bg-[#F4F5F7]">
              <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => selectSpace("home")}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                  >
                    <IconArrowLeft className="h-4 w-4" />
                    <span>Pharmacies</span>
                  </button>

                  <div className="flex min-w-0 items-center gap-2">
                    <IconLogo className="h-6 w-6 shrink-0 text-brand-700" />
                    <span className="truncate font-display text-sm font-bold text-slate-900">
                      {session.establishmentName}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => selectSpace("settings")}
                    aria-label="Paramètres"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
                  >
                    <IconSettings className="h-5 w-5" />
                  </button>
                </div>
              </header>
              <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
                <PharmacyView />
              </main>
            </div>
          ) : (
            <ProfessionalAuth
              defaultType="pharmacy"
              onBack={() => selectSpace("home")}
              onOpenOther={(type) => {
                if (type === "hospital" && FEATURES.hospitals) {
                  selectSpace("hospital");
                }
              }}
            />
          )
        ) : null}

        {activeSpace === "emergency" && FEATURES.hospitals ? (
          <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
            <Emergency onManage={() => selectSpace("hospital")} />
          </main>
        ) : null}

        {activeSpace === "hospital" && FEATURES.hospitals ? (
          session?.type === "hospital" ? (
            <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
              <HospitalView />
            </main>
          ) : (
            <ProfessionalAuth
              defaultType="hospital"
              onBack={() => selectSpace("home")}
              onOpenOther={(type) =>
                selectSpace(
                  type === "hospital" && FEATURES.hospitals ? "hospital" : "account",
                )
              }
            />
          )
        ) : null}
      </div>

      {recoveryCode ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-5">
          <div className="pointer-events-auto w-full max-w-md animate-fade-up rounded-2xl border border-brand-200 bg-white p-5 shadow-lift">
            <p className="text-sm font-bold text-brand-800">
              Code de secours — à conserver
            </p>
            <p
              aria-live="polite"
              className="mt-1.5 font-mono text-lg font-bold tracking-wide text-slate-900"
            >
              {recoveryCode}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Il réinitialise votre code d&apos;accès. Il n&apos;est affiché qu&apos;une
              fois et chaque utilisation le remplace.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(recoveryCode)
                    .then(() => notify("Code de secours copié."))
                    .catch(() => notify("Copie impossible — notez le code."));
                }}
                className="btn-secondary"
              >
                Copier
              </button>
              <button
                type="button"
                onClick={dismissRecoveryCode}
                className="btn-primary"
              >
                J&apos;ai sauvegardé le code
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[70] w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 animate-fade-up rounded-2xl bg-slate-900/95 px-4 py-3 text-center text-sm font-medium text-white shadow-float backdrop-blur"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
