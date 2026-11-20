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
  IconUserCheck,
} from "../icons";
import { FEATURES } from "@/lib/features";
import type { ProfessionalType } from "@/lib/types";

export default function SettingsView({
  onOpenProfessional,
}: {
  onOpenProfessional: (type: ProfessionalType) => void;
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
  const { settings } = state;

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
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                <IconCrosshair className="h-3.5 w-3.5 text-brand-600" />
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
                  className="btn-secondary px-3 py-1.5 text-[11px]"
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
                  className="btn-secondary px-3 py-1.5 text-[11px]"
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
              className="btn-secondary text-xs"
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

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {session?.type === "hospital" ? (
                <IconHospital className="h-4 w-4 text-slate-500" />
              ) : session?.type === "admin" ? (
                <IconUserCheck className="h-4 w-4 text-slate-500" />
              ) : (
                <IconPharmacy className="h-4 w-4 text-slate-500" />
              )}
              <h2 className="text-sm font-semibold text-ink-900">
                Accès professionnels &amp; Administration
              </h2>
            </div>
            {session ? <Badge tone="green">Connecté</Badge> : null}
          </div>

          {session ? (
            <>
              <p className="mt-3 text-sm font-semibold text-ink-900">
                {session.establishmentName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {session.managerName} · {session.role}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {session.email}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {session.type === "pharmacy"
                  ? "Compte pharmacie — accès limité à cette officine."
                  : session.type === "hospital"
                    ? "Compte hôpital — accès limité à cet établissement."
                    : "Compte administrateur — modération et validation des officines."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenProfessional(session.type)}
                  className="btn-primary text-xs"
                >
                  Ouvrir mon espace
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    notify("Déconnecté du compte professionnel.");
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
                Aucun compte professionnel connecté. Accédez à l&apos;espace de
                votre officine ou à l&apos;administration Kéné.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenProfessional("pharmacy")}
                  className="btn-secondary text-xs"
                >
                  <IconPharmacy className="h-4 w-4" />
                  Espace pharmacie
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
                <button
                  type="button"
                  onClick={() => onOpenProfessional("admin")}
                  className="btn-secondary text-xs"
                >
                  <IconUserCheck className="h-4 w-4" />
                  Administration
                </button>
              </div>
              <p className="mt-3 text-[10px] text-slate-500">
                Comptes gérés en base SQL (codes hachés scrypt, session
                HttpOnly). Les nouvelles pharmacies attendent la validation
                administrateur avant publication.
              </p>
            </>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
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
            className="btn-primary whitespace-nowrap text-xs"
          >
            <IconDownload className="h-4 w-4" />
            Installer Kéné sur cet appareil
          </button>
        ) : null}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-900">
          Abonnement pharmacie
        </h2>
        <Card className="relative border-brand-500 p-5 ring-1 ring-brand-200">
          <span className="absolute right-5 top-5">
            <Badge tone="green">Plan actuel</Badge>
          </span>
          <p className="text-sm font-semibold text-ink-900">{settings.plan}</p>
          <p className="mt-1 max-w-lg text-xs leading-relaxed text-slate-500">
            Le back-office est facturé à la pharmacie, jamais au patient. 25 000
            FCFA par mois et par officine, sans engagement, réglés par Wave ou
            Orange Money.
          </p>
          <p className="mt-4 text-2xl font-semibold text-ink-900">
            25 000 FCFA
            <span className="text-xs font-normal text-slate-500"> / mois</span>
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              "Stock et prix visibles en temps réel par les patients",
              "Import CSV / Excel en masse et mise à jour instantanée",
              "Mise en avant « de garde » 24 h/24 et géolocalisation GPS",
              "Contact direct par téléphone, WhatsApp et itinéraire",
              "Fiche officine complète, agrément vérifié et horaires",
              "Support dédié et multi-officines (sur devis)",
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-xs text-slate-600"
              >
                <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              notify("La facturation sera disponible à la mise en production.")
            }
            className="btn-secondary mt-5 text-xs"
          >
            Gérer l&apos;abonnement
          </button>
        </Card>
      </div>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500">
            <IconTrash className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              Données de démonstration
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Réinitialise les stocks, comptes et officines d&apos;origine en
              base SQL. Vos modifications seront perdues.
            </p>
          </div>
        </div>

        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2">
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
              className="btn whitespace-nowrap bg-red-600 px-4 py-2.5 text-xs text-white hover:bg-red-700"
            >
              {resetting
                ? "Réinitialisation…"
                : "Confirmer la réinitialisation"}
            </button>
            <button
              type="button"
              disabled={resetting}
              onClick={() => setConfirmReset(false)}
              className="btn-secondary whitespace-nowrap text-xs"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="btn-secondary whitespace-nowrap text-xs"
          >
            Réinitialiser la démo
          </button>
        )}
      </Card>

      <p className="text-center text-[11px] text-slate-500">
        Préférences patient et position GPS stockées localement dans votre
        navigateur · stocks et comptes synchronisés avec le serveur Kéné
      </p>
    </div>
  );
}
