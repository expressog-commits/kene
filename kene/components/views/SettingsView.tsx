"use client";

import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Badge, Card } from "../ui";
import {
  IconCheck,
  IconCrosshair,
  IconDownload,
  IconHospital,
  IconLogout,
  IconPharmacy,
  IconSearch,
  IconShield,
  IconTrash,
} from "../icons";
import { FEATURES } from "@/lib/features";

export default function SettingsView({
  onOpenProfessional,
}: {
  onOpenProfessional: (type: "pharmacy" | "hospital") => void;
}) {
  const {
    state,
    session,
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
    signOut,
    resetDemo,
    notify,
  } = useStore();

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

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
            Préférences patient (locales)
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">
            Enregistrées uniquement dans votre navigateur pour retrouver plus
            vite vos pharmacies et recherches habituelles.
          </p>

          <div className="mt-5">
            <label
              className="mb-1.5 block text-sm font-semibold text-slate-700"
              htmlFor="preferred-quartier"
            >
              Quartier par défaut
            </label>
            <select
              id="preferred-quartier"
              className="input h-12 text-[15px]"
              value={activeQuartier}
              onChange={(event) => {
                setPreferredQuartier(event.target.value);
                notify("Quartier par défaut enregistré dans ce navigateur.");
              }}
            >
              {quartiers.map((quartier) => (
                <option key={quartier} value={quartier}>
                  {quartier === "Tous" ? "Tous les quartiers" : quartier}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <IconPharmacy className="h-4 w-4 text-brand-700" />
                  Pharmacies favorites
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
                  : "Aucune pharmacie favorite enregistrée."}
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
                  : "Aucune recherche récente enregistrée."}
              </p>
            </div>
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

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={!hasLocalPrefs}
              onClick={() => {
                clearPatientPrefs();
                notify("Préférences patient locales effacées.");
              }}
              className="btn-secondary h-12 w-full rounded-xl px-5 text-[15px] sm:w-auto"
            >
              <IconTrash className="h-4 w-4" />
              Effacer mes préférences locales
            </button>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-3.5 text-sm leading-relaxed text-slate-700">
            <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
            <p>
              Aucune donnée personnelle patient (nom, téléphone, position GPS,
              recherche ou favori) n&apos;est envoyée ni stockée sur le serveur
              Kéné : tout reste localement dans ce navigateur.
            </p>
          </div>
        </Card>

        <Card className="flex flex-col justify-between rounded-2xl p-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <IconPharmacy className="h-5 w-5" />
                </span>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Espace Pharmacie
                </h2>
              </div>
              {session ? (
                <Badge tone="green" dot className="shrink-0">
                  Connecté
                </Badge>
              ) : null}
            </div>

            {session ? (
              <>
                <p className="mt-5 text-base font-bold text-slate-900">
                  {session.establishmentName}
                </p>
                <p className="mt-1 text-[15px] text-slate-700">
                  {session.managerName} · {session.role}
                </p>
                <p className="mt-1 break-all text-sm text-slate-600">
                  {session.email}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                  Gérez votre stock, vos horaires de garde et votre position GPS
                  en temps réel.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenProfessional(
                        session.type === "hospital" && FEATURES.hospitals
                          ? "hospital"
                          : "pharmacy",
                      )
                    }
                    className="btn-primary h-12 rounded-xl px-5 text-[15px]"
                  >
                    Ouvrir mon espace
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                      notify("Déconnecté de l'espace pharmacie.");
                    }}
                    className="btn-secondary h-12 rounded-xl px-5 text-[15px]"
                  >
                    <IconLogout className="h-4 w-4" />
                    Se déconnecter
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-5 text-[15px] leading-relaxed text-slate-600">
                  Vous êtes pharmacien ? Connectez votre officine ou inscrivez-la
                  gratuitement pour publier votre stock, vos prix et vos
                  horaires de garde.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenProfessional("pharmacy")}
                    className="btn-primary h-12 rounded-xl px-5 text-[15px]"
                  >
                    <IconPharmacy className="h-4 w-4" />
                    Accéder à l&apos;Espace Pharmacie
                  </button>
                  {FEATURES.hospitals ? (
                    <button
                      type="button"
                      onClick={() => onOpenProfessional("hospital")}
                      className="btn-secondary h-12 rounded-xl px-5 text-[15px]"
                    >
                      <IconHospital className="h-4 w-4" />
                      Espace hôpital
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <IconDownload className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="font-display text-base font-bold text-slate-900">
                Application mobile (PWA)
              </p>
              {isPwaInstalled ? (
                <Badge tone="green" dot>
                  Application installée
                </Badge>
              ) : null}
            </div>
            <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">
              {isPwaInstalled
                ? "Kéné est installé sur votre appareil et garde vos derniers résultats accessibles hors connexion."
                : canInstallPwa
                  ? "Installez Kéné sur votre écran d'accueil pour accéder aux pharmacies et gardes en un geste."
                  : "Sur Android (Chrome) : menu ⋮ → Installer l'application. Sur iPhone / iPad (Safari) : bouton Partager → Sur l'écran d'accueil."}
            </p>
          </div>
        </div>

        {!isPwaInstalled && canInstallPwa ? (
          <button
            type="button"
            onClick={async () => {
              const accepted = await installPwa();
              if (accepted) {
                notify("Kéné a été installé sur cet appareil.");
              }
            }}
            className="btn-primary h-12 w-full whitespace-nowrap rounded-xl px-5 text-[15px] sm:w-auto"
          >
            <IconDownload className="h-4 w-4" />
            Installer Kéné sur cet appareil
          </button>
        ) : null}
      </Card>

      <div>
        <h2 className="mb-4 font-display text-lg font-bold text-slate-900">
          Modèle économique Kéné : Publicité &amp; Abonnement
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl border-brand-200 bg-brand-50/40 p-6 ring-1 ring-brand-200/70">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <p className="font-display text-base font-bold text-slate-900">
                1. Financement par la Publicité
              </p>
              <Badge tone="green" dot pulse>
                Phase actuelle · Publicité
              </Badge>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
              Aujourd&apos;hui, la plateforme est{" "}
              <strong>100 % gratuite</strong> pour les patients comme pour
              l&apos;inscription des pharmacies. Kéné se finance grâce aux
              espaces publicitaires dédiés aux acteurs et partenaires de la
              santé.
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Recherche et géolocalisation gratuites pour tous les patients",
                "Inscription et publication du stock gratuites pour les officines",
                "Espaces publicitaires clairement identifiés (partenaires santé & parapharmacie)",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-[15px] text-slate-800"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <IconCheck className="h-3 w-3" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <p className="font-display text-base font-bold text-slate-900">
                2. Abonnement Pharmacies
              </p>
              <Badge tone="amber" dot>
                Une fois devenue la référence
              </Badge>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
              Une fois que la plateforme Kéné sera installée comme la référence
              incontournable pour trouver un médicament, les pharmacies paieront
              un tarif d&apos;abonnement pour la diffusion de leur stock en
              temps réel et leurs outils avancés.
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Diffusion prioritaire du stock, des prix et des gardes 24h/24",
                "Import automatisé CSV / Excel et synchronisation du catalogue",
                "Jamais facturé au patient — service public d'orientation gratuit",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-[15px] text-slate-800"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-brand-700">
                    <IconCheck className="h-3 w-3" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <IconTrash className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-slate-900">
              Données de démonstration
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-600">
              Réinitialise les stocks, comptes et officines d&apos;origine. Vos
              modifications seront perdues.
            </p>
          </div>
        </div>

        {confirmReset ? (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={resetting}
              onClick={async () => {
                if (resetting) return;
                setResetting(true);
                await resetDemo();
                setResetting(false);
                setConfirmReset(false);
              }}
              className="btn h-12 w-full whitespace-nowrap rounded-xl bg-rose-600 px-5 text-[15px] text-white hover:bg-rose-700 sm:w-auto"
            >
              {resetting
                ? "Réinitialisation…"
                : "Confirmer la réinitialisation"}
            </button>
            <button
              type="button"
              disabled={resetting}
              onClick={() => setConfirmReset(false)}
              className="btn-secondary h-12 w-full whitespace-nowrap rounded-xl px-5 text-[15px] sm:w-auto"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="btn-secondary h-12 w-full whitespace-nowrap rounded-xl px-5 text-[15px] sm:w-auto"
          >
            Réinitialiser la démo
          </button>
        )}
      </Card>

      <p className="text-center text-sm text-slate-600">
        Préférences patient et position GPS stockées localement dans votre
        navigateur · stocks synchronisés avec le serveur Kéné
      </p>
    </div>
  );
}
