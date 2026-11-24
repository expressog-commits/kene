import {
  IconArrowRight,
  IconBed,
  IconCheck,
  IconLogo,
  IconMapPin,
  IconNavigation,
  IconPharmacy,
  IconPhone,
  IconSearch,
  IconShield,
} from "@/components/icons";
import {
  dutyPharmacies,
  emergencySummary,
  filterHospitals,
  publicPharmacies,
} from "@/lib/engine";
import { FEATURES } from "@/lib/features";
import { distanceLabel } from "@/lib/format";
import { mapsDirectionsLink } from "@/lib/geo";
import { seedState } from "@/lib/seed";
import { ensureSeeded, loadPublicState } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Tapez le nom de votre médicament",
    body: "Recherchez un médicament ou ajoutez toute votre ordonnance. Aucun compte ni inscription n'est nécessaire.",
  },
  {
    title: "Voyez où il est disponible et à quel prix",
    body: "Comparez les pharmacies ouvertes ou de garde autour de vous, avec le stock indiqué et le prix avant de partir.",
  },
  {
    title: "Lancez l'itinéraire ou appelez la pharmacie",
    body: "Ouvrez Google Maps en un clic, appelez l'officine ou confirmez sur WhatsApp avant de vous déplacer.",
  },
] as const;

const PHARMACY_BENEFITS = [
  "Inscription gratuite et immédiate de votre officine",
  "Mise à jour des stocks et des prix en quelques secondes (ou par fichier CSV/Excel)",
  "Signalement de vos gardes 24 h/24 visible par les patients à proximité",
  "Aucun paiement ni vente en ligne : les patients viennent au comptoir",
] as const;

const QUICK_PILLS = [
  { label: "Paracétamol", href: "/app?view=search&q=Parac%C3%A9tamol" },
  { label: "Amoxicilline", href: "/app?view=search&q=Amoxicilline" },
  { label: "Artéméther", href: "/app?view=search&q=Art%C3%A9m%C3%A9ther" },
  { label: "Pharmacies de garde", href: "/app?view=duty" },
] as const;

export default async function LandingPage() {
  let state = seedState();
  try {
    await ensureSeeded();
    state = await loadPublicState(null);
  } catch {
    state = seedState();
  }

  const verified = publicPharmacies(state);
  const dutyList = dutyPharmacies(state);
  const featuredDuty = dutyList.slice(0, 4);
  const beds = emergencySummary(state);

  const bedsSample = FEATURES.hospitals
    ? filterHospitals(state, {
        quartier: "Tous",
        service: "Toutes les urgences",
        onlyAvailable: false,
      })
        .slice(0, 4)
        .map((row) => ({
          id: row.hospital.id,
          name: row.hospital.name,
          area: `${row.hospital.quartier} · ${distanceLabel(row.hospital.distanceKm)}`,
          free: row.available,
          wait: row.wait !== null ? `${row.wait} min` : "complet",
        }))
    : [];

  return (
    <div className="min-h-screen bg-canvas text-slate-900">
      <a href="#contenu" className="skip-link">
        Aller au contenu principal
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <a
            href="/"
            className="group flex items-center gap-2.5 rounded-xl focus-visible:outline-offset-4"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70 transition group-hover:bg-brand-100/80">
              <IconLogo className="h-6 w-6" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              Kéné
            </span>
          </a>

          <nav
            aria-label="Navigation principale"
            className="flex items-center gap-2 sm:gap-3"
          >
            <a
              href="/app?view=duty"
              className="hidden min-h-[44px] items-center gap-2 rounded-xl px-3.5 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-100/80 hover:text-brand-700 md:inline-flex"
            >
              <span>Pharmacies de garde</span>
              {dutyList.length > 0 ? (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-50 px-1.5 text-[13px] font-bold tabular-nums text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  {dutyList.length}
                </span>
              ) : null}
            </a>

            {FEATURES.hospitals ? (
              <a
                href="/app?view=emergency"
                className="hidden min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-100/80 hover:text-brand-700 lg:inline-flex"
              >
                <IconBed className="h-4 w-4 text-brand-700" />
                <span>Urgences</span>
              </a>
            ) : null}

            <a
              href="/app?view=pharmacy"
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-brand-700 hover:bg-brand-50/40 hover:text-brand-800 sm:px-4 sm:text-[15px]"
            >
              <IconPharmacy className="h-4 w-4 shrink-0 text-brand-700" />
              <span className="sm:hidden">Pharmacien ?</span>
              <span className="hidden sm:inline">Vous êtes pharmacien ?</span>
            </a>

            <a
              href="tel:185"
              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-rose-50 px-3 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200/80 transition hover:bg-rose-100 sm:px-3.5"
            >
              <IconPhone className="h-4 w-4 shrink-0" />
              <span>SAMU 185</span>
            </a>
          </nav>
        </div>
      </header>

      <main id="contenu" tabIndex={-1} className="focus:outline-none">
        <section className="bg-brand-700 bg-gradient-to-br from-[#045D56] via-brand-700 to-[#034A44] py-14 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-emerald-50 ring-1 ring-inset ring-white/15">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-emerald-300"
              />
              {FEATURES.hospitals
                ? `Abidjan · ${verified.length} pharmacies vérifiées · ${beds.centers} hôpitaux`
                : `Abidjan · ${verified.length} pharmacies vérifiées · ${dutyList.length} de garde 24h/24`}
            </p>

            <h1 className="font-display max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Trouvez votre médicament en pharmacie à Abidjan.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-emerald-50/90 sm:text-lg">
              {FEATURES.hospitals
                ? "Voyez quelles pharmacies l'ont en stock et à quel prix avant de vous déplacer, ainsi que les lits disponibles aux urgences. Gratuit et sans inscription."
                : "Voyez quelles pharmacies l'ont en stock et à quel prix avant de vous déplacer. Gratuit et sans inscription."}
            </p>

            <form
              action="/app"
              method="GET"
              role="search"
              aria-label="Rechercher un médicament en pharmacie"
              className="mt-8 flex max-w-3xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-lift focus-within:ring-4 focus-within:ring-white/25 sm:flex-row sm:items-center"
            >
              <input type="hidden" name="view" value="search" />
              <div className="relative flex flex-1 items-center">
                <IconSearch className="pointer-events-none absolute left-3.5 h-5 w-5 text-brand-700" />
                <input
                  type="search"
                  name="q"
                  aria-label="Nom du médicament"
                  placeholder="Ex : Paracétamol, Amoxicilline, Artéméther…"
                  className="h-14 w-full rounded-xl bg-transparent pl-11 pr-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-700 px-7 text-base font-bold text-white transition hover:bg-brand-800 active:scale-[0.98] sm:h-14"
              >
                <IconSearch className="h-5 w-5 sm:hidden" />
                <span>Rechercher</span>
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {QUICK_PILLS.map((pill) => (
                <a
                  key={pill.label}
                  href={pill.href}
                  className="inline-flex min-h-[40px] items-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/25"
                >
                  {pill.label}
                </a>
              ))}
              {FEATURES.hospitals ? (
                <a
                  href="/app?view=emergency"
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/25"
                >
                  <IconBed className="h-4 w-4 shrink-0" />
                  Lits d&apos;urgence ({beds.available})
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section id="garde" className="bg-canvas py-14">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Pharmacies de garde maintenant
                </h2>
                <p className="mt-1.5 text-[15px] text-slate-600">
                  Permanence 24 h/24 à Abidjan — vérifiez l&apos;adresse et contactez
                  directement la pharmacie.
                </p>
              </div>
              <a
                href="/app?view=duty"
                className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-brand-700 transition hover:text-brand-800"
              >
                <span>Voir toutes les pharmacies de garde</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>

            {featuredDuty.length > 0 ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {featuredDuty.map(({ pharmacy, distanceKm }) => (
                  <article
                    key={pharmacy.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:border-brand-500/50 hover:shadow-soft"
                  >
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="text-lg font-bold leading-snug text-slate-900">
                          {pharmacy.name}
                        </h3>
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-emerald-600"
                          />
                          De garde 24h/24
                        </span>
                      </div>

                      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-medium text-slate-800">
                        <IconMapPin className="h-4 w-4 shrink-0 text-brand-700" />
                        <span>{pharmacy.quartier}</span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className="font-semibold tabular-nums text-brand-700">
                          {distanceLabel(distanceKm)}
                        </span>
                      </p>

                      <p className="mt-1.5 text-sm text-slate-600">
                        {pharmacy.address}
                      </p>

                      {pharmacy.dutyNote ? (
                        <p className="mt-3 rounded-xl bg-emerald-50/70 px-3.5 py-2 text-sm font-medium text-emerald-900">
                          {pharmacy.dutyNote}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                      <a
                        href={mapsDirectionsLink(pharmacy)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-[15px] font-semibold text-white transition hover:bg-brand-800 active:scale-[0.98]"
                      >
                        <IconNavigation className="h-4 w-4 shrink-0" />
                        Itinéraire
                      </a>
                      <a
                        href={`tel:${pharmacy.phone.replace(/\s+/g, "")}`}
                        className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 text-[15px] font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
                      >
                        <IconPhone className="h-4 w-4 shrink-0 text-brand-700" />
                        Appeler
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
                <p className="text-[15px] font-medium text-slate-700">
                  Consultez la liste complète et la carte interactive des pharmacies
                  ouvertes à Abidjan.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <a
                    href="/app?view=duty"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 text-[15px] font-semibold text-white transition hover:bg-brand-800"
                  >
                    Voir les pharmacies de garde
                  </a>
                  <a
                    href="tel:185"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 text-[15px] font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    <IconPhone className="h-4 w-4 text-rose-700" />
                    SAMU 185
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        {FEATURES.hospitals ? (
          <section id="urgences" className="border-t border-slate-200/70 bg-canvas pb-14">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    Lits disponibles aux urgences
                  </h2>
                  <p className="mt-1.5 text-[15px] text-slate-600">
                    {beds.available} lits libres signalés dans {beds.centers} hôpitaux
                    à Abidjan.
                  </p>
                </div>
                <a
                  href="/app?view=emergency"
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-brand-700 transition hover:text-brand-800"
                >
                  <span>Voir tous les services d&apos;urgence</span>
                  <IconArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {bedsSample.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <IconBed className="h-5 w-5" />
                      </span>
                      <span className="text-lg font-bold tabular-nums text-brand-700">
                        {item.free} {item.free > 1 ? "lits" : "lit"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-bold text-slate-900">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{item.area}</p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      Attente estimée : {item.wait}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section
          id="fonctionnement"
          className="border-y border-slate-200/70 bg-white py-14"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Comment ça marche ?
              </h2>
              <p className="mt-2 text-[15px] text-slate-600">
                Simple, gratuit et accessible à tous depuis votre téléphone ou votre
                ordinateur.
              </p>
            </div>

            <div className="mt-9 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="flex flex-col items-start">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-700 text-base font-bold tabular-nums text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pharmacies" className="bg-canvas py-14">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-start lg:gap-12">
            <div>
              <p className="text-sm font-semibold text-brand-700">
                Espace officine
              </p>
              <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Vous êtes pharmacien ?
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                Rendez votre stock et vos gardes visibles aux patients d&apos;Abidjan
                qui cherchent leurs médicaments autour de votre pharmacie.
              </p>

              <ul className="mt-6 space-y-3">
                {PHARMACY_BENEFITS.map((benefit) => (
                  <li
                    key={benefit}
                    className="flex items-start gap-3 text-[15px] text-slate-700"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-brand-700 ring-1 ring-inset ring-emerald-200">
                      <IconCheck className="h-3.5 w-3.5" />
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                <a
                  href="/app?view=pharmacy"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 text-[15px] font-semibold text-white transition hover:bg-brand-800 active:scale-[0.98]"
                >
                  <IconPharmacy className="h-5 w-5 shrink-0" />
                  Accéder à l&apos;espace pharmacie
                </a>
              </div>
            </div>

            <div id="tarifs" className="space-y-4">
              <div className="rounded-2xl border-2 border-brand-700/25 bg-white p-6 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    Aujourd&apos;hui
                  </span>
                  <span className="text-sm font-semibold text-brand-700">
                    100 % gratuit
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-bold text-slate-900">
                  Gratuit, financé par la publicité santé
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                  L&apos;accès est gratuit pour tous les patients et pour toutes les
                  pharmacies partenaires. Kéné est financée par la publicité dédiée
                  aux acteurs de la santé et de la parapharmacie.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[13px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                    Demain
                  </span>
                  <span className="text-sm font-medium text-slate-600">
                    Une fois devenue la référence
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-bold text-slate-900">
                  Abonnement pharmacies
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                  Une fois que Kéné sera devenue la référence quotidienne à Abidjan,
                  les officines souscriront un abonnement pour maintenir leur
                  visibilité et leurs outils de mise à jour.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70">
                <IconLogo className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-base font-bold text-slate-900">
                  Kéné
                </p>
                <p className="text-sm text-slate-600">
                  Disponibilité des médicaments et pharmacies de garde à Abidjan
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-700">
              <a href="/app?view=search" className="hover:text-brand-700">
                Rechercher un médicament
              </a>
              <a href="/app?view=duty" className="hover:text-brand-700">
                Pharmacies de garde
              </a>
              {FEATURES.hospitals ? (
                <a href="/app?view=emergency" className="hover:text-brand-700">
                  Urgences
                </a>
              ) : null}
              <a href="/app?view=pharmacy" className="hover:text-brand-700">
                Espace pharmacie
              </a>
              <a href="tel:185" className="text-rose-800 hover:text-rose-900">
                SAMU 185
              </a>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-slate-200/80 pt-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-start gap-2">
              <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              <span>
                Information et orientation uniquement — pas de vente en ligne, ni
                de réservation médicale.
              </span>
            </p>
            <a
              href="tel:185"
              className="font-semibold text-rose-800 hover:text-rose-900"
            >
              Urgence vitale : appelez le SAMU 185
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
