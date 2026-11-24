"use client";

import { useMemo } from "react";
import { useStore } from "../store";
import { Badge, Card } from "../ui";
import {
  IconCrosshair,
  IconDownload,
  IconSearch,
  IconShield,
  IconStar,
  IconTrash,
} from "../icons";

export default function SettingsView() {
  const {
    state,
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

  const quartiers = useMemo(
    () => [
      "Tous",
      ...Array.from(
        new Set(state.pharmacies.map((pharmacy) => pharmacy.quartier)),
      ),
    ],
    [state.pharmacies],
  );

  const favoritePharmacies = useMemo(
    () =>
      state.pharmacies.filter((pharmacy) =>
        favoritePharmacyIds.includes(pharmacy.id),
      ),
    [state.pharmacies, favoritePharmacyIds],
  );

  const activeQuartier = quartiers.includes(preferredQuartier)
    ? preferredQuartier
    : "Tous";

  const hasLocalPrefs =
    activeQuartier !== "Tous" ||
    favoritePharmacyIds.length > 0 ||
    recentSearches.length > 0;

  const locationSummary =
    locationStatus === "granted" && userLocation
      ? `Active (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`
      : locationStatus === "locating"
        ? "Recherche de votre position…"
        : locationStatus === "denied"
          ? "Autorisation refusée dans le navigateur"
          : locationStatus === "unsupported"
            ? "Non prise en charge sur cet appareil"
            : "Non activée";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl p-6">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Mes préférences
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">
            Enregistrées uniquement sur votre appareil pour retrouver plus vite
            vos pharmacies et recherches habituelles.
          </p>

          <div className="mt-5">
            <label
              className="mb-1.5 block text-sm font-semibold text-slate-700"
              htmlFor="preferred-quartier"
            >
              Commune par défaut
            </label>
            <select
              id="preferred-quartier"
              className="input h-12 py-2.5 text-[15px] leading-snug"
              value={activeQuartier}
              onChange={(event) => {
                setPreferredQuartier(event.target.value);
                notify("Commune par défaut enregistrée sur cet appareil.");
              }}
            >
              {quartiers.map((quartier) => (
                <option key={quartier} value={quartier}>
                  {quartier === "Tous" ? "Tout Abidjan" : quartier}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <IconCrosshair className="h-4 w-4 shrink-0 text-brand-700" />
                Position GPS locale
              </p>
              <p className="mt-1 text-sm tabular-nums text-slate-600">
                {locationSummary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!userLocation ? (
                <button
                  type="button"
                  disabled={locationStatus === "locating"}
                  onClick={() => requestLocation()}
                  className="btn-secondary h-12 w-full rounded-xl px-4 text-[15px] sm:w-auto"
                >
                  Activer ma position
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    clearLocation();
                    notify("Position GPS effacée.");
                  }}
                  className="btn-secondary h-12 w-full rounded-xl px-4 text-[15px] sm:w-auto"
                >
                  Effacer ma position
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <IconStar className="h-4 w-4 text-sun-500" />
                  Favorites
                </span>
                <Badge tone="neutral" className="tabular-nums">
                  {favoritePharmacies.length}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {favoritePharmacies.length > 0
                  ? favoritePharmacies
                      .slice(0, 3)
                      .map((pharmacy) => pharmacy.name)
                      .join(", ") +
                    (favoritePharmacies.length > 3
                      ? ` (+${favoritePharmacies.length - 3})`
                      : "")
                  : "Aucune pharmacie favorite."}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <IconSearch className="h-4 w-4 text-brand-700" />
                  Recherches récentes
                </span>
                <Badge tone="neutral" className="tabular-nums">
                  {recentSearches.length}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {recentSearches.length > 0
                  ? recentSearches.slice(0, 3).join(", ") +
                    (recentSearches.length > 3
                      ? ` (+${recentSearches.length - 3})`
                      : "")
                  : "Aucune recherche récente."}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <button
              type="button"
              disabled={!hasLocalPrefs}
              onClick={() => {
                clearPatientPrefs();
                notify("Préférences locales effacées.");
              }}
              className="btn-secondary h-12 w-full rounded-xl px-5 text-[15px] sm:w-auto"
            >
              <IconTrash className="h-4 w-4" />
              Effacer mes préférences locales
            </button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <IconDownload className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Application sur votre téléphone
                  </h2>
                  {isPwaInstalled ? (
                    <Badge tone="green" dot>
                      Installée
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">
                  {isPwaInstalled
                    ? "Kéné est installé sur votre appareil et reste consultable même avec une connexion instable."
                    : canInstallPwa
                      ? "Installez Kéné sur votre écran d'accueil pour retrouver les pharmacies en un geste."
                      : "Sur Android (Chrome) : menu ⋮ → Installer l'application. Sur iPhone / iPad (Safari) : bouton Partager → Sur l'écran d'accueil."}
                </p>

                {!isPwaInstalled && canInstallPwa ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const accepted = await installPwa();
                      if (accepted) {
                        notify("Kéné a été installé sur cet appareil.");
                      }
                    }}
                    className="btn-primary mt-5 h-12 w-full rounded-xl px-5 text-[15px] sm:w-auto"
                  >
                    <IconDownload className="h-4 w-4" />
                    Installer Kéné sur cet appareil
                  </button>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-brand-100 bg-brand-50/50 p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
                <IconShield className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Confidentialité
                </h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-700">
                  Aucune donnée personnelle (nom, téléphone, position GPS, recherche ou
                  pharmacie favorite) n&apos;est envoyée ni stockée sur nos serveurs :
                  tout reste uniquement dans votre navigateur.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
