import {
  IconAlert,
  IconArrowRight,
  IconBed,
  IconCheck,
  IconClock,
  IconCrosshair,
  IconDownload,
  IconList,
  IconLogo,
  IconMap,
  IconMapPin,
  IconNavigation,
  IconPharmacy,
  IconPhone,
  IconPill,
  IconSearch,
  IconShield,
} from "@/components/icons";
import { Capsule3D, GlowOrb, GlassChip, BedGrid3D } from "@/components/visuals";
import {
  LEVEL_META,
  dutyPharmacies,
  emergencySummary,
  filterHospitals,
  openingLabel,
  publicPharmacies,
  searchMedicine,
} from "@/lib/engine";
import { FEATURES } from "@/lib/features";
import { distanceLabel, fcfaShort } from "@/lib/format";
import { seedState } from "@/lib/seed";
import { ensureSeeded, loadPublicState } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const STATS = [
  { value: "26 %", label: "des ménages face à une rupture de médicament", source: "Afrobarometer" },
  { value: "54 %", label: "trouvent l'accès aux soins difficile", source: "Afrobarometer" },
  { value: "30 %", label: "du marché pharmaceutique serait informel", source: "estimation sectorielle" },
  { value: "10", label: "communes du Grand Abidjan géolocalisées", source: "Kéné" },
];

const PROBLEMS = [
  {
    title: "La rupture, découverte trop tard",
    body: "Un quart des officines n'a pas le produit demandé le jour même. Le patient apprend la rupture à la caisse, après avoir payé le taxi.",
  },
  {
    title: "Le prix change d'une rue à l'autre",
    body: "Sans comparateur, une même boîte peut coûter 30 % de plus à 500 mètres. Les familles arbitrent à l'aveugle, faute d'information.",
  },
  {
    title: "Trois pharmacies pour une boîte",
    body: "Appels, déplacements, files d'attente : trouver un traitement devient une demi-journée perdue, souvent avec un enfant malade.",
  },
];

const STEPS = [
  {
    title: "Cherchez un produit ou une liste",
    body: "Nom commercial, molécule (DCI) ou jusqu'à 8 médicaments à la fois. Kéné interroge les stocks déclarés par les pharmacies vérifiées.",
  },
  {
    title: "Comparez distance GPS, stock et prix",
    body: "Activez « Autour de moi », filtrez par commune, officine ouverte ou de garde 24 h/24, et affichez les résultats sur liste ou carte interactive.",
  },
  {
    title: "Contactez ou prenez la route",
    body: "Lancez l'itinéraire Google Maps, appelez l'officine ou confirmez la disponibilité par WhatsApp. Aucune réservation, aucun paiement en ligne.",
  },
];

const PHARMACY_FEATURES = [
  "Stock et prix modifiables en quelques secondes",
  "Import CSV / Excel en masse jusqu'à 200 lignes",
  "Ajout et retrait de références en un clic",
  "Mise en avant « de garde 24 h/24 » avec note dédiée",
  "Badge officine vérifiée (numéro d'agrément ONP/DPML)",
  "Fiche officine, coordonnées GPS et WhatsApp à jour",
];

const QUICK_LINKS = [
  { label: "Paracétamol", href: "/app?view=search&q=Parac%C3%A9tamol" },
  { label: "Amoxicilline", href: "/app?view=search&q=Amoxicilline" },
  { label: "Artéméther", href: "/app?view=search&q=Art%C3%A9m%C3%A9ther" },
  { label: "Doliprane", href: "/app?view=search&q=Doliprane" },
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
  const beds = emergencySummary(state);

  const artemetherMatches = searchMedicine(state, "Artéméther", {
    quartier: "Tous",
    onlyOpen: false,
    onlyDuty: false,
    onlyInStock: false,
    sort: "distance",
  });

  const seenHeroPharmacies = new Set<string>();
  const heroRows: Array<{
    id: string;
    name: string;
    area: string;
    price: string;
    tone: "green" | "amber" | "red";
    note: string;
  }> = [];

  for (const row of artemetherMatches) {
    if (seenHeroPharmacies.has(row.pharmacy.id)) continue;
    seenHeroPharmacies.add(row.pharmacy.id);
    const meta = LEVEL_META[row.level];
    heroRows.push({
      id: row.pharmacy.id,
      name: row.pharmacy.name,
      area: `${row.pharmacy.quartier} · ${distanceLabel(row.distanceKm)}`,
      price: row.level === "out" ? "—" : fcfaShort(row.stock.price),
      tone: meta.tone,
      note: meta.label,
    });
    if (heroRows.length >= 3) break;
  }

  if (heroRows.length === 0) {
    for (const pharmacy of verified.slice(0, 3)) {
      heroRows.push({
        id: pharmacy.id,
        name: pharmacy.name,
        area: `${pharmacy.quartier} · ${distanceLabel(pharmacy.distanceKm)}`,
        price: "En rayon",
        tone: "green",
        note: openingLabel(pharmacy),
      });
    }
  }

  const heroMatchCount = new Set(artemetherMatches.map((row) => row.pharmacy.id)).size;

  const bedsSample = FEATURES.hospitals
    ? filterHospitals(state, {
        quartier: "Tous",
        service: "Toutes les urgences",
        onlyAvailable: false,
      })
        .slice(0, 4)
        .map((row) => ({
          name: row.hospital.name,
          area: `${row.hospital.quartier} · ${distanceLabel(row.hospital.distanceKm)}`,
          free: row.available,
          wait: row.wait !== null ? `${row.wait} min` : "complet",
        }))
    : [];

  return (
    <div className="min-h-screen overflow-x-hidden bg-sand">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-sand/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <a href="/" className="flex items-center gap-2.5">
            <IconLogo className="h-8 w-8 text-brand-500" />
            <span className="text-lg font-semibold tracking-tight text-ink-900">Kéné</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#probleme" className="transition hover:text-ink-900">
              Le problème
            </a>
            {FEATURES.hospitals ? (
              <a href="#urgences" className="transition hover:text-ink-900">
                Urgences
              </a>
            ) : (
              <a href="#garde" className="transition hover:text-ink-900">
                De garde
              </a>
            )}
            <a href="#fonctionnement" className="transition hover:text-ink-900">
              Fonctionnement
            </a>
            <a href="#tarifs" className="transition hover:text-ink-900">
              Pharmacies
            </a>
          </nav>
          <a href="/app?view=search" className="btn-primary px-4 py-2 text-xs sm:text-sm">
            Ouvrir Kéné
            <IconArrowRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="mesh-grid absolute inset-0" />
          <GlowOrb className="-right-24 -top-24 h-[26rem] w-[26rem]" tone="brand" />
          <GlowOrb className="-bottom-32 -left-24 h-[22rem] w-[22rem]" tone="sun" />

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.04fr_0.96fr] lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-brand-700 backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                {FEATURES.hospitals
                  ? `Abidjan · ${verified.length} pharmacies vérifiées et ${beds.centers} hôpitaux`
                  : `Abidjan · ${verified.length} pharmacies vérifiées · ${dutyList.length} de garde`}
              </span>
              <h1 className="mt-5 text-[2.45rem] font-semibold leading-[1.05] tracking-tight text-ink-900 sm:text-5xl">
                Votre médicament est en stock.
                <span className="block bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 bg-clip-text text-transparent">
                  On vous dit où, et à quel prix.
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                {FEATURES.hospitals ? (
                  <>
                    Kéné montre en quelques secondes quelles pharmacies vérifiées déclarent
                    avoir votre médicament ou toute votre liste en stock, à quel prix et à
                    quelle distance GPS. Et quand la situation l&apos;exige, il affiche
                    les <strong>lits libres aux urgences</strong> des hôpitaux
                    d&apos;Abidjan.
                  </>
                ) : (
                  <>
                    Kéné montre en quelques secondes quelles pharmacies vérifiées
                    d&apos;Abidjan déclarent avoir votre médicament ou toute votre liste
                    en rayon, à quel prix et à quelle distance GPS — avec accès immédiat
                    aux <strong>pharmacies de garde 24 h/24</strong> et à la carte.
                  </>
                )}
              </p>

              <form
                action="/app"
                method="GET"
                className="mt-6 flex flex-col gap-2.5 sm:flex-row"
              >
                <input type="hidden" name="view" value="search" />
                <div className="relative flex-1">
                  <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    name="q"
                    aria-label="Rechercher un médicament"
                    placeholder="Ex : Paracétamol, Amoxicilline, Artéméther…"
                    className="input bg-white py-3.5 pl-11 pr-3 shadow-card"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary whitespace-nowrap px-6 py-3.5 shadow-[0_18px_30px_-14px_rgba(11,126,114,0.9)]"
                >
                  <IconSearch className="h-4 w-4" />
                  Trouver
                </button>
              </form>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                {QUICK_LINKS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:border-brand-400 hover:bg-brand-50"
                  >
                    {item.label}
                  </a>
                ))}
                {FEATURES.hospitals ? (
                  <a
                    href="/app?view=emergency"
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100"
                  >
                    <IconBed className="h-3.5 w-3.5" />
                    Voir les lits d&apos;urgence
                  </a>
                ) : (
                  <a
                    href="/app?view=duty"
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100"
                  >
                    <IconClock className="h-3.5 w-3.5" />
                    Pharmacies de garde ({dutyList.length})
                  </a>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <IconCheck className="h-3.5 w-3.5 text-brand-500" />
                  Gratuit pour les patients
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <IconList className="h-3.5 w-3.5 text-brand-500" />
                  Recherche simple ou par liste
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <IconCrosshair className="h-3.5 w-3.5 text-brand-500" />
                  GPS, carte &amp; app mobile (PWA)
                </span>
              </div>
            </div>

            <div className="hero-scene relative">
              <div className="absolute inset-x-8 top-8 -z-10 h-[92%] rounded-[2rem] bg-gradient-to-br from-brand-300/50 via-brand-100/40 to-sun-200/50 blur-[1px]" />
              <div className="hero-3d relative">
                <Capsule3D className="absolute -right-6 -top-10 z-30 h-12 w-24 rotate-[38deg]" />
                <GlassChip className="float-y absolute -left-5 -top-9 z-30 hidden sm:flex sm:items-center sm:gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500 text-white">
                    <IconPill className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold text-ink-900">
                      {state.medicines.length} médicaments
                    </p>
                    <p className="text-[9px] text-slate-500">
                      dans {verified.length} pharmacies vérifiées
                    </p>
                  </div>
                </GlassChip>

                <div className="rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_50px_90px_-40px_rgba(11,31,29,0.55)] backdrop-blur">
                  <a
                    href="/app?view=search&q=Art%C3%A9m%C3%A9ther"
                    className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-brand-400"
                  >
                    <IconSearch className="h-4 w-4 text-slate-400" />
                    <span className="text-xs text-slate-700">
                      Artéméther-Luméfantrine 20/120
                    </span>
                    <span className="ml-auto rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                      {heroMatchCount || verified.length} résultats
                    </span>
                  </a>

                  <div className="mt-3 space-y-2">
                    {heroRows.map((row) => (
                      <a
                        key={row.id}
                        href="/app?view=search&q=Art%C3%A9m%C3%A9ther"
                        className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 transition hover:border-brand-200 hover:bg-slate-50/60"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            row.tone === "green"
                              ? "bg-brand-50 text-brand-600"
                              : row.tone === "amber"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-red-50 text-red-500"
                          }`}
                        >
                          <IconPill className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink-900">
                            {row.name}
                          </p>
                          <p className="text-[10px] text-slate-500">{row.area}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-ink-900">{row.price}</p>
                          <p className="text-[10px] text-slate-500">{row.note}</p>
                        </div>
                      </a>
                    ))}
                  </div>

                  <a
                    href="/app?view=search&q=Art%C3%A9m%C3%A9ther"
                    className="mt-4 flex items-center justify-between rounded-xl bg-ink-900 px-4 py-3 transition hover:bg-ink-800"
                  >
                    <div className="text-white">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        Orientation directe
                      </p>
                      <p className="text-xs font-semibold">
                        Itinéraire GPS · Appel · WhatsApp
                      </p>
                    </div>
                    <span className="rounded-lg bg-brand-400 px-2.5 py-1.5 text-[10px] font-bold text-ink-900">
                      Sans réservation
                    </span>
                  </a>
                </div>

                <GlassChip className="float-delay absolute -bottom-7 -left-3 z-30 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-brand-300">
                    {FEATURES.hospitals ? (
                      <IconBed className="h-4 w-4" />
                    ) : (
                      <IconClock className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    {FEATURES.hospitals ? (
                      <>
                        <p className="text-[10px] font-semibold text-ink-900">
                          {beds.available} lits libres aux urgences
                        </p>
                        <p className="text-[9px] text-slate-500">
                          dans {beds.centers} hôpitaux d&apos;Abidjan
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-semibold text-ink-900">
                          {dutyList.length} pharmacie{dutyList.length > 1 ? "s" : ""} de garde
                        </p>
                        <p className="text-[9px] text-slate-500">
                          ouvertes 24 h/24 à Abidjan
                        </p>
                      </>
                    )}
                  </div>
                </GlassChip>
              </div>
              <p className="mt-8 text-center text-[10px] text-slate-500 lg:mt-6">
                Stocks et prix déclarés en base par les officines vérifiées
              </p>
            </div>
          </div>
        </section>

        <section className="bg-ink-900">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.value}>
                <p className="text-3xl font-semibold tracking-tight text-white">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{stat.label}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">
                  {stat.source}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="probleme" className="mx-auto w-full max-w-6xl px-5 py-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
              Le problème
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
              Le médicament existe. Le trouver est le vrai problème.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              En Côte d&apos;Ivoire, la santé est le deuxième sujet de préoccupation des
              ménages. Le système distribue mal : les officines du Plateau ne savent pas ce
              qui manque à Yopougon, et les patients paient chaque détour.
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {PROBLEMS.map((problem, index) => (
              <div key={problem.title} className="card card-lift p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sand text-xs font-bold text-brand-700">
                  0{index + 1}
                </span>
                <h3 className="mt-4 text-sm font-semibold text-ink-900">{problem.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {problem.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="fonctionnement" className="border-y border-slate-200/70 bg-white">
          <div className="mx-auto w-full max-w-6xl px-5 py-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                  Fonctionnement
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
                  Trois gestes, pas trois déplacements.
                </h2>
              </div>
              <a
                href="/app?view=search"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Essayer maintenant
                <IconArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl bg-sand p-6 transition hover:shadow-card"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Étape {index + 1}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-ink-900">{step.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{step.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: IconMapPin,
                  label: "Par commune & GPS",
                  text: "Plateau, Cocody, Yopougon, Adjamé, Marcory, Abobo, Koumassi…",
                },
                {
                  icon: IconMap,
                  label: "Vue carte interactive",
                  text: "Visualisez les officines disponibles et de garde autour de vous.",
                },
                {
                  icon: IconShield,
                  label: "Officines vérifiées",
                  text: "Agrément contrôlé avant mise en ligne des stocks déclarés.",
                },
                {
                  icon: IconDownload,
                  label: "Installable sur mobile",
                  text: "PWA légère consultable même avec une connexion instable.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-ink-900">{item.label}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {FEATURES.hospitals ? (
          <section id="urgences" className="mx-auto w-full max-w-6xl px-5 py-16">
            <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-10 sm:px-10">
              <div className="hero-grid absolute inset-0" />
              <GlowOrb className="-right-20 top-0 h-72 w-72" tone="brand" />

              <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-brand-200">
                    <IconBed className="h-3.5 w-3.5" />
                    Urgences hospitalières
                  </span>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                    Un lit libre, avant de prendre la route.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
                    Aux heures où chaque minute compte, savoir quel service d&apos;urgence
                    a de la place change tout. Kéné affiche les lits libres par hôpital et
                    par service — adultes, pédiatrie, maternité, réanimation,
                    traumatologie — avec le temps d&apos;attente estimé.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {bedsSample.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-400/15 text-brand-300">
                          <IconBed className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-white">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400">{item.area}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-brand-300">{item.free}</p>
                          <p className="text-[9px] text-slate-400">
                            {item.wait === "complet" ? "complet" : `≈ ${item.wait}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <a
                      href="/app?view=emergency"
                      className="btn bg-white px-4 py-2.5 text-xs text-ink-900 hover:bg-slate-100"
                    >
                      <IconBed className="h-4 w-4" />
                      Voir les lits aux urgences
                    </a>
                    <span className="text-[11px] text-slate-400">
                      {beds.available} lits libres dans {beds.centers} hôpitaux
                    </span>
                  </div>
                </div>

                <div>
                  <BedGrid3D className="h-64" />
                  <div className="mt-2 flex flex-wrap justify-center gap-3 text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-brand-400" /> libre
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-sun-400" /> tension
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-500" /> occupé
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section id="garde" className="mx-auto w-full max-w-6xl px-5 py-16">
            <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-10 sm:px-10">
              <div className="hero-grid absolute inset-0" />
              <GlowOrb className="-right-20 top-0 h-72 w-72" tone="brand" />

              <div className="relative grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-brand-200">
                    <IconClock className="h-3.5 w-3.5" />
                    Permanence 24 h/24 · Abidjan
                  </span>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                    Pharmacies de garde, la nuit comme le week-end.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
                    Retrouvez immédiatement les officines vérifiées signalées de garde,
                    vérifiez leurs médicaments en stock et lancez l&apos;itinéraire GPS ou
                    l&apos;appel en un geste.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {dutyList.slice(0, 4).map(({ pharmacy, distanceKm, inStockCount }) => (
                      <div
                        key={pharmacy.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 backdrop-blur"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-400/15 text-brand-300">
                          <IconPharmacy className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-white">
                            {pharmacy.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {pharmacy.quartier} · {distanceLabel(distanceKm)}
                          </p>
                          {pharmacy.dutyNote ? (
                            <p className="truncate text-[10px] text-brand-200">
                              {pharmacy.dutyNote}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-brand-300">24 h/24</p>
                          <p className="text-[9px] text-slate-400">{inStockCount} réf.</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <a
                      href="/app?view=duty"
                      className="btn bg-white px-4 py-2.5 text-xs text-ink-900 hover:bg-slate-100"
                    >
                      <IconNavigation className="h-4 w-4" />
                      Voir les pharmacies de garde
                    </a>
                    <a
                      href="tel:185"
                      className="btn border border-white/20 px-4 py-2.5 text-xs text-white hover:bg-white/10"
                    >
                      <IconPhone className="h-4 w-4" />
                      Urgence vitale : SAMU 185
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-300">
                    Géolocalisation &amp; Carte
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    Trouvez l&apos;officine ouverte la plus proche de votre position.
                  </p>
                  <ul className="mt-4 space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                      Calcul de distance GPS réel en temps réel
                    </li>
                    <li className="flex items-start gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                      Carte interactive OpenStreetMap sans inscription
                    </li>
                    <li className="flex items-start gap-2">
                      <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                      Itinéraire Google Maps, appel et WhatsApp directs
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="pharmacies" className="mx-auto w-full max-w-6xl px-5 pb-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                Pour les pharmacies
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
                Votre stock devient votre vitrine.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
                Kéné n&apos;est pas un site de vente et ne prend pas de réservation.
                C&apos;est un outil d&apos;orientation pensé pour une officine de quartier :
                le pharmacien importe ou actualise son stock en quelques secondes, publie
                ses gardes et accueille des patients qui savent déjà que le produit est
                disponible.
              </p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {PHARMACY_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-slate-600">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div id="tarifs" className="card border-brand-500 p-6 ring-1 ring-brand-200">
              <div className="flex items-center justify-between">
                <span className="chip bg-brand-50 text-brand-700">Pharmacie Pro</span>
                <span className="text-[11px] text-slate-500">sans engagement</span>
              </div>
              <p className="mt-5 text-3xl font-semibold tracking-tight text-ink-900">
                25 000 FCFA
                <span className="text-xs font-normal text-slate-400"> / mois</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Par officine vérifiée. Import CSV en masse, stock en temps réel, mise en
                avant de garde et contact WhatsApp direct. Réglé par Wave ou Orange Money.
              </p>
              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                {[
                  "Les patients ne paient rien, jamais",
                  "Aucune commission sur les passages au comptoir",
                  "Vérification de l'officine et prise en main incluses",
                ].map((line) => (
                  <p key={line} className="flex items-center gap-2 text-xs text-slate-600">
                    <IconCheck className="h-3.5 w-3.5 text-brand-500" />
                    {line}
                  </p>
                ))}
              </div>
              <a href="/app?view=pharmacy" className="btn-primary mt-6 w-full text-xs">
                Voir le back-office
              </a>
              <p className="mt-2 text-center text-[10px] text-slate-400">
                Démo avec {verified.length} pharmacies vérifiées et{" "}
                {state.medicines.length} médicaments
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200/70 bg-white">
          <div className="mx-auto w-full max-w-6xl px-5 py-14">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                  Cadre clair
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
                  Ce que Kéné n&apos;est pas.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Un outil strict d&apos;information et d&apos;orientation, jamais un acte
                  médical. Kéné n&apos;appartient pas au corps médical : cette limite est
                  volontaire et protège les patients comme les officines.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Pas du corps médical : aucun diagnostic ni avis thérapeutique",
                  "Pas de vente, de livraison ni de paiement en ligne",
                  "Pas de réservation de médicament ni de lit d'urgence",
                  "Le pharmacien et le médecin restent seuls décideurs",
                ].map((line) => (
                  <div
                    key={line}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-xs leading-relaxed text-slate-600"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-start gap-2.5 rounded-xl bg-sun-50 px-4 py-3">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun-600" />
              <p className="text-[11px] leading-relaxed text-sun-800">
                Urgence vitale : appelez le <strong>185 (SAMU)</strong> ou rendez-vous au
                centre de santé le plus proche. Kéné ne remplace ni un médecin, ni un
                pharmacien.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-16">
          <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 text-center sm:px-12">
            <div className="hero-grid absolute inset-0" />
            <GlowOrb className="-right-16 -top-16 h-56 w-56" tone="brand" />
            <GlowOrb className="-bottom-20 -left-10 h-56 w-56" tone="sun" />
            <Capsule3D className="absolute right-10 top-8 hidden h-10 w-20 rotate-45 opacity-90 sm:block" />
            <p className="relative text-[11px] font-semibold uppercase tracking-wide text-brand-300">
              Abidjan, maintenant
            </p>
            <h2 className="relative mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white">
              Arrêtez de chercher. Commencez par savoir.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              Ouvrez l&apos;application installable, trouvez votre médicament, comparez
              toute une liste ou localisez la pharmacie de garde la plus proche.
            </p>
            <div className="relative mt-7 flex flex-wrap justify-center gap-3">
              <a
                href="/app?view=search"
                className="btn bg-brand-400 px-5 py-3 text-ink-900 hover:bg-brand-300"
              >
                <IconSearch className="h-4 w-4" />
                Ouvrir Kéné
              </a>
              <a
                href="/app?view=duty"
                className="btn border border-white/20 px-5 py-3 text-white hover:bg-white/10"
              >
                <IconClock className="h-4 w-4" />
                Pharmacies de garde
              </a>
              <a
                href="/app?view=pharmacy"
                className="btn border border-white/20 px-5 py-3 text-white hover:bg-white/10"
              >
                <IconPharmacy className="h-4 w-4" />
                Espace pharmacie
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <IconLogo className="h-7 w-7 text-brand-500" />
            <div>
              <p className="text-sm font-semibold text-ink-900">Kéné</p>
              <p className="text-[11px] text-slate-500">
                Orientation pharmacie et garde 24 h/24 · Abidjan
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
            <a href="/app?view=search" className="hover:text-ink-900">
              Application
            </a>
            <a href="/app?view=duty" className="hover:text-ink-900">
              De garde
            </a>
            <a href="#tarifs" className="hover:text-ink-900">
              Tarifs pharmacies
            </a>
            <span>Données de démonstration, aucune réservation ni vente</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
