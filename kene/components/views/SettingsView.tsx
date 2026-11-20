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
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink-900">
            Préférences patient (locales)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Enregistrées uniquement dans votre navigateur pour retrouver plus
            vite vos pharmacies et recherches habituelles.
          </p>

          <div className="mt-4">
            <label className="label" htmlFor="preferred-quartier">
              Quartier par défaut
            </label>
            <select
              id="preferred-quartier"
              className="input"
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

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                  <IconPharmacy className="h-3.5 w-3.5 text-brand-600" />
                  Pharmacies favorites
                </span>
                <Badge tone="neutral">{favoritePharmacies.length}</Badge>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
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

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                  <IconSearch className="h-3.5 w-3.5 text-brand-600" />
                  Recherches récentes
                </span>
                <Badge tone="neutral">{recentSearches.length}</Badge>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                {recentSearches.length > 0
                  ? recentSearches.slice(0, 3).join(", ") +
                    (recentSearches.length > 3
                      ? ` (+${recentSearches.length - 3})`
                      : "")
                  : "Aucune recherche récente enregistrée."}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                <IconCrosshair className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                Position GPS locale
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {locationSummary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!userLocation ? (
                <button
                  type="button"
                  disabled={locationStatus === "locating"}
                  onClick={() => requestLocation()}
                  className="btn-secondary w-full px-3 py-2 text-[11px] sm:w-auto"
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
                  className="btn-secondary w-full px-3 py-2 text-[11px] sm:w-auto"
                >
                  Effacer ma position
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={!hasLocalPrefs}
              onClick={() => {
                clearPatientPrefs();
                notify("Préférences patient locales effacées.");
              }}
              className="btn-secondary w-full text-xs sm:w-auto"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Effacer mes préférences locales
            </button>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
            <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <p>
              Aucune donnée personnelle patient (nom, téléphone, position GPS,
              recherche ou favori) n&apos;est envoyée ni stockée sur le serveur
              Kéné : tout reste localement dans ce navigateur.
            </p>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconPharmacy className="h-4 w-4 shrink-0 text-brand-600" />
              <h2 className="text-sm font-semibold text-ink-900">
                Espace Pharmacie
              </h2>
            </div>
            {session ? (
              <Badge tone="green" className="shrink-0">
                Connecté
              </Badge>
            ) : null}
          </div>

          {session ? (
            <>
              <p className="mt-3 text-sm font-semibold text-ink-900">
                {session.establishmentName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {session.managerName} · {session.role}
              </p>
              <p className="mt-0.5 break-all text-[11px] text-slate-500">
                {session.email}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Gérez votre stock, vos horaires de garde et votre position GPS
                en temps réel.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onOpenProfessional(
                      session.type === "hospital" && FEATURES.hospitals
                        ? "hospital"
                        : "pharmacy",
                    )
                  }
                  className="btn-primary text-xs"
                >
                  Ouvrir mon espace
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    notify("Déconnecté de l'espace pharmacie.");
                  }}
                  className="btn-secondary text-xs"
                >
                  <IconLogout className="h-4 w-4" />
                  Se déconnecter
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Vous êtes pharmacien ? Connectez votre officine ou inscrivez-la
                gratuitement pour publier votre stock, vos prix et vos horaires
                de garde.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenProfessional("pharmacy")}
                  className="btn-primary text-xs"
                >
                  <IconPharmacy className="h-4 w-4" />
                  Accéder à l&apos;Espace Pharmacie
                </button>
                {FEATURES.hospitals ? (
                  <button
                    type="button"
                    onClick={() => onOpenProfessional("hospital")}
                    className="btn-secondary text-xs"
                  >
                    <IconHospital className="h-4 w-4" />
                    Espace hôpital
                  </button>
                ) : null}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <IconDownload className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink-900">
                Application mobile (PWA)
              </p>
              {isPwaInstalled ? (
                <Badge tone="green">Application installée</Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
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
            className="btn-primary w-full whitespace-nowrap text-xs sm:w-auto"
          >
            <IconDownload className="h-4 w-4" />
            Installer Kéné sur cet appareil
          </button>
        ) : null}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-900">
          Modèle économique Kéné : Publicité &amp; Abonnement
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-brand-500 p-4 ring-1 ring-brand-200 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-900">
                1. Financement par la Publicité
              </p>
              <Badge tone="green">Phase actuelle · Publicité</Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Aujourd&apos;hui, la plateforme est{" "}
              <strong>100 % gratuite</strong> pour les patients comme pour
              l&apos;inscription des pharmacies. Kéné se finance grâce aux
              espaces publicitaires dédiés aux acteurs et partenaires de la
              santé.
            </p>
            <ul className="mt-4 space-y-2">
              {[
                "Recherche et géolocalisation gratuites pour tous les patients",
                "Inscription et publication du stock gratuites pour les officines",
                "Espaces publicitaires clairement identifiés (partenaires santé & parapharmacie)",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs text-slate-600"
                >
                  <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-900">
                2. Abonnement Pharmacies
              </p>
              <Badge tone="amber">Une fois devenue la référence</Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Une fois que la plateforme Kéné sera installée comme la référence
              incontournable pour trouver un médicament, les pharmacies paieront
              un tarif d&apos;abonnement pour la diffusion de leur stock en
              temps réel et leurs outils avancés.
            </p>
            <ul className="mt-4 space-y-2">
              {[
                "Diffusion prioritaire du stock, des prix et des gardes 24h/24",
                "Import automatisé CSV / Excel et synchronisation du catalogue",
                "Jamais facturé au patient — service public d'orientation gratuit",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs text-slate-600"
                >
                  <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <IconTrash className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              Données de démonstration
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Réinitialise les stocks, comptes et officines d&apos;origine. Vos
              modifications seront perdues.
            </p>
          </div>
        </div>

        {confirmReset ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
              className="btn w-full whitespace-nowrap bg-red-600 px-4 py-2.5 text-xs text-white hover:bg-red-700 sm:w-auto"
            >
              {resetting
                ? "Réinitialisation…"
                : "Confirmer la réinitialisation"}
            </button>
            <button
              type="button"
              disabled={resetting}
              onClick={() => setConfirmReset(false)}
              className="btn-secondary w-full whitespace-nowrap text-xs sm:w-auto"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="btn-secondary w-full whitespace-nowrap text-xs sm:w-auto"
          >
            Réinitialiser la démo
          </button>
        )}
      </Card>

      <p className="text-center text-[11px] text-slate-500">
        Préférences patient et position GPS stockées localement dans votre
        navigateur · stocks synchronisés avec le serveur Kéné
      </p>
    </div>
  );
}
