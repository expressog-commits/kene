"use client";

import { useMemo, useState } from "react";
import { useStore } from "../store";
import { cn } from "../ui";
import {
  IconArrowLeft,
  IconChevronRight,
  IconCrosshair,
  IconDownload,
  IconLogout,
  IconMapPin,
  IconPharmacy,
  IconPhone,
  IconShare,
  IconShield,
  IconSmartphone,
  IconTrash,
} from "../icons";

export default function SettingsView({
  onBack,
  onOpenAccount,
  onFindNearby,
}: {
  onBack: () => void;
  onOpenAccount: () => void;
  onFindNearby: () => void;
}) {
  const {
    state,
    session,
    signOut,
    userLocation,
    locationStatus,
    requestLocation,
    clearLocation,
    canInstallPwa,
    isPwaInstalled,
    installPwa,
    favoritePharmacyIds,
    recentSearches,
    preferredQuartier,
    setPreferredQuartier,
    clearPatientPrefs,
    notify,
  } = useStore();

  const [showInstallTip, setShowInstallTip] = useState(false);
  const [showPrivacyNote, setShowPrivacyNote] = useState(false);

  const quartiers = useMemo(
    () => [
      "Tous",
      ...Array.from(
        new Set(state.pharmacies.map((pharmacy) => pharmacy.quartier)),
      ),
    ],
    [state.pharmacies],
  );

  const activeQuartier = quartiers.includes(preferredQuartier)
    ? preferredQuartier
    : "Tous";

  const hasLocalPrefs =
    activeQuartier !== "Tous" ||
    favoritePharmacyIds.length > 0 ||
    recentSearches.length > 0;

  const handleShare = async () => {
    const shareUrl =
      typeof window !== "undefined" ? window.location.origin : "https://kene.ci";
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "Kéné — Pharmacies d'Abidjan",
          text: "Trouvez rapidement vos médicaments et les pharmacies de garde à Abidjan.",
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard?.writeText(shareUrl);
      notify("Lien Kéné copié !");
    } catch {
      notify("Partage annulé.");
    }
  };

  const handleInstall = async () => {
    if (isPwaInstalled) {
      notify("Kéné est déjà installé sur cet appareil.");
      return;
    }
    if (canInstallPwa) {
      const accepted = await installPwa();
      if (accepted) notify("Kéné installé sur votre écran d'accueil.");
      return;
    }
    setShowInstallTip((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-slate-900">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-4 sm:px-6">
        <header className="flex items-center gap-3 py-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour aux pharmacies"
            className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-900 transition hover:bg-black/5"
          >
            <IconArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="font-display text-[22px] font-bold tracking-tight text-slate-900">
            Paramètres
          </h1>
        </header>

        <div className="mt-5 space-y-6">
          <section aria-labelledby="settings-account-heading">
            <h2
              id="settings-account-heading"
              className="mb-2 px-1 text-sm font-semibold text-slate-500"
            >
              Compte
            </h2>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <button
                type="button"
                onClick={onOpenAccount}
                className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-3.5">
                  <IconPharmacy className="h-5 w-5 shrink-0 text-slate-900" />
                  <span className="truncate text-[15px] font-medium text-slate-900">
                    {session?.type === "pharmacy"
                      ? session.establishmentName
                      : "Se connecter / Compte Pharmacie"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {session?.type === "pharmacy" ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      Connecté
                    </span>
                  ) : null}
                  <IconChevronRight className="h-4 w-4 text-slate-400" />
                </span>
              </button>

              {session ? (
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    notify("Déconnecté.");
                    onOpenAccount();
                  }}
                  className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3.5">
                    <IconLogout className="h-5 w-5 shrink-0 text-slate-900" />
                    <span className="text-[15px] font-medium text-slate-900">
                      Changer de compte / Se déconnecter
                    </span>
                  </span>
                  <IconChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="settings-prefs-heading">
            <h2
              id="settings-prefs-heading"
              className="mb-2 px-1 text-sm font-semibold text-slate-500"
            >
              Préférences
            </h2>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3">
                <label
                  htmlFor="preferred-quartier"
                  className="flex items-center gap-3.5 text-[15px] font-medium text-slate-900"
                >
                  <IconMapPin className="h-5 w-5 shrink-0 text-slate-900" />
                  <span>Commune par défaut</span>
                </label>
                <select
                  id="preferred-quartier"
                  aria-label="Commune par défaut"
                  value={activeQuartier}
                  onChange={(event) => {
                    setPreferredQuartier(event.target.value);
                    notify("Commune par défaut enregistrée sur cet appareil.");
                  }}
                  className="max-w-[155px] rounded-xl bg-slate-100 px-3 py-2 text-right text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
                >
                  {quartiers.map((quartier) => (
                    <option key={quartier} value={quartier}>
                      {quartier === "Tous" ? "Tout Abidjan" : quartier}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={locationStatus === "locating"}
                onClick={() => {
                  if (userLocation) {
                    clearLocation();
                    notify("Position GPS effacée.");
                  } else {
                    requestLocation();
                  }
                }}
                className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 disabled:opacity-60"
              >
                <span className="flex items-center gap-3.5">
                  <IconCrosshair className="h-5 w-5 shrink-0 text-slate-900" />
                  <span className="text-[15px] font-medium text-slate-900">
                    Position GPS locale
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    userLocation ? "text-brand-700" : "text-slate-500",
                  )}
                >
                  {userLocation
                    ? "Active · Effacer"
                    : locationStatus === "locating"
                      ? "Localisation…"
                      : locationStatus === "denied"
                        ? "Refusée"
                        : "Activer"}
                </span>
              </button>

              {hasLocalPrefs ? (
                <button
                  type="button"
                  onClick={() => {
                    clearPatientPrefs();
                    notify("Préférences locales effacées.");
                  }}
                  className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3.5">
                    <IconTrash className="h-5 w-5 shrink-0 text-slate-900" />
                    <span className="text-[15px] font-medium text-slate-900">
                      Effacer favoris et recherches
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                    {favoritePharmacyIds.length} fav. · {recentSearches.length} rech.
                  </span>
                </button>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="settings-share-heading">
            <h2
              id="settings-share-heading"
              className="mb-2 px-1 text-sm font-semibold text-slate-500"
            >
              Partager
            </h2>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <a
                href="/kene-android.apk"
                download
                className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-3.5">
                  <IconSmartphone className="h-5 w-5 shrink-0 text-slate-900" />
                  <span className="text-[15px] font-medium text-slate-900">
                    Télécharger pour Android (.apk)
                  </span>
                </span>
                <IconChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </a>

              <div>
                <button
                  type="button"
                  onClick={() => void handleInstall()}
                  aria-expanded={showInstallTip}
                  className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3.5">
                    <IconDownload className="h-5 w-5 shrink-0 text-slate-900" />
                    <span className="text-[15px] font-medium text-slate-900">
                      Installer l&apos;application
                    </span>
                  </span>
                  {isPwaInstalled ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      Installée
                    </span>
                  ) : (
                    <IconChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                </button>
                {showInstallTip && !isPwaInstalled ? (
                  <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-slate-600">
                    Sur Android (Chrome) : menu ⋮ → Installer l&apos;application. Sur
                    iPhone (Safari) : bouton Partager → Sur l&apos;écran d&apos;accueil.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void handleShare()}
                className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-3.5">
                  <IconShare className="h-5 w-5 shrink-0 text-slate-900" />
                  <span className="text-[15px] font-medium text-slate-900">
                    Inviter un proche à utiliser Kéné
                  </span>
                </span>
                <IconChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            </div>
          </section>

          <section aria-labelledby="settings-support-heading">
            <h2
              id="settings-support-heading"
              className="mb-2 px-1 text-sm font-semibold text-slate-500"
            >
              Support
            </h2>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <a
                href="tel:185"
                className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-3.5">
                  <IconPhone className="h-5 w-5 shrink-0 text-slate-900" />
                  <span className="text-[15px] font-medium text-slate-900">
                    Urgence vitale · Appeler le SAMU 185
                  </span>
                </span>
                <IconChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </a>

              <button
                type="button"
                onClick={onFindNearby}
                className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-3.5">
                  <IconMapPin className="h-5 w-5 shrink-0 text-slate-900" />
                  <span className="text-[15px] font-medium text-slate-900">
                    Trouver les pharmacies à proximité
                  </span>
                </span>
                <IconChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>

              <div>
                <button
                  type="button"
                  onClick={() => setShowPrivacyNote((prev) => !prev)}
                  aria-expanded={showPrivacyNote}
                  className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3.5">
                    <IconShield className="h-5 w-5 shrink-0 text-slate-900" />
                    <span className="text-[15px] font-medium text-slate-900">
                      Confidentialité &amp; informations
                    </span>
                  </span>
                  <IconChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
                {showPrivacyNote ? (
                  <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-slate-600">
                    Aucune donnée personnelle (position GPS, recherches ou favoris)
                    n&apos;est envoyée à nos serveurs : tout reste sur votre appareil.
                    Outil d&apos;information uniquement — aucune vente ni réservation
                    médicale.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
