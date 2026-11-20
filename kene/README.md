# Kéné

**Trouver le médicament qui est là, près de chez soi — Abidjan, Côte d'Ivoire.**

Kéné est un **outil strictement d'information et d'orientation** sur la disponibilité des médicaments à Abidjan : le patient cherche un produit, compare une liste complète dans les officines vérifiées, repère les **pharmacies de garde** et leur distance GPS réelle, puis contacte directement l'officine par appel, WhatsApp ou itinéraire Google Maps.

> **Cadre non médical & démo produit.** Kéné n'appartient pas au corps médical : il ne vend aucun médicament, ne réalise aucun paiement en ligne, n'analyse pas d'ordonnance et ne prend aucune réservation médicale ni de lit. Les stocks, prix, coordonnées et comptes de démonstration sont fictifs.

## Ce que fait l'application (V1)

### Côté patient (gratuit, sans compte ni donnée personnelle envoyée)

- **Recherche simple & multi-médicaments** : recherche multi-mots insensible aux accents (nom commercial, DCI, forme, catégorie) et comparateur « Liste / Ordonnance » (2 à 8 médicaments, classement par disponibilité complète puis partielle, total estimé en FCFA).
- **Pharmacies de garde & carte GPS** : onglet dédié aux officines de garde vérifiées, note de garde, géolocalisation navigateur (Haversine `lib/geo.ts`, avec repli sur les coordonnées de commune), et carte interactive Leaflet / OpenStreetMap.
- **Visibilité contrôlée** : seules les officines ayant le statut `verified` apparaissent aux patients ; les officines en attente (`pending`) ou suspendues (`suspended`) sont filtrées côté serveur (`loadPublicState`) et moteur (`publicPharmacies`).
- **Préférences locales** : quartier par défaut, pharmacies favorites et recherches récentes enregistrés uniquement dans `localStorage`.

### Côté pharmacie (back-office officine)

- **Compte professionnel isolé** : création de compte (statut initial `pending` avec numéro d'ordre `licenseNumber` et géolocalisation par commune) et connexion par email + code.
- **Stock temps réel & import CSV** : mise à jour des prix/quantités, ajout depuis le catalogue ou création de référence, suppression, confirmation d'inventaire (`publishStock`), et **import en masse CSV** (`lib/csv.ts` + transaction `bulkImportStock`, jusqu'à 200 lignes).
- **Fiche officine & garde** : édition du nom, commune, téléphone, WhatsApp, adresse, coordonnées GPS, horaires (`openFrom` / `openTo`), bascule « de garde » et note de garde (`dutyNote`).

### Côté administration plateforme

- **Modération des officines** : le compte administrateur (`admin`) consulte toutes les pharmacies (`verified`, `pending`, `suspended`) et valide ou suspend leur publication publique via `setPharmacyVerification`.

### Phase 2 (désactivée par défaut)

- **Urgences hospitalières (`NEXT_PUBLIC_ENABLE_HOSPITALS`)** : le module des lits d'urgences hospitalières est conservé dans la base Prisma et les routes API derrière `FEATURES.hospitals` (`false` par défaut en V1). En passant `NEXT_PUBLIC_ENABLE_HOSPITALS="true"`, les endpoints et vues hôpitaux s'activent sans migration.

## Stack & persistance

- **Frontend / App** : Next.js 14 (App Router), React 18, TypeScript (`strict: true`), Tailwind CSS, Leaflet (`leaflet`)
- **Validation & Base de données** : Zod (`zod`) + **Prisma ORM** (`@prisma/client` / `prisma`)
  - Développement / démo locale : SQLite (`prisma/schema.prisma`, `DATABASE_URL="file:./kene.db"`)
  - Production multi-instances : schéma PostgreSQL prêt à l'emploi (`prisma/schema.postgres.prisma`)
- **Tests** : Node built-in test runner (`node --import tsx --test tests/*.test.ts`)

## Démarrer

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm test
npm run typecheck
npm run dev      # http://localhost:3000
```

- `/` — page de présentation (données dynamiques depuis Prisma)
- `/app` — application (`?view=search|duty|pharmacy|admin|hospital|settings`)
- `/api/health` — vérification de disponibilité base SQL (`SELECT 1`) et feature flags

## Sécurité

- **Mots de passe / codes d'accès** : hachés `scrypt` (`KEY_LENGTH = 64`) avec sel aléatoire ; longueur validée strictement entre 6 et 72 caractères (`rawTrimmed`, sans troncature silencieuse).
- **Sessions** : jeton aléatoire de 32 octets stocké sous forme de SHA-256 dans la table SQL `Session`, cookie `kene_session` `HttpOnly` + `SameSite=Lax` (+ `Secure` en production), TTL 8 h.
- **Validation & autorisations** : schémas Zod sur `/api/auth` et `/api/actions`, isolation stricte par établissement (`403`), contrôle administrateur pour `setPharmacyVerification`, désactivation possible du reset démo via `KENE_DISABLE_DEMO_RESET="true"` (+ rate limit `3 / 10 min`).
- **CSRF & en-têtes HTTP (`next.config.mjs`)** : `isSameOrigin` (`Origin`, `Sec-Fetch-Site`, `Referer`) + `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`, `Content-Security-Policy` (autorisant les tuiles OpenStreetMap), `Cache-Control: no-store` sur les API.

## Données & comptes de démonstration

- **8 pharmacies** réparties sur 8 communes d'Abidjan : 7 `verified` (dont `Pharmacie de Yopougon-Liberté` et `Pharmacie Saint-Jean` de garde 24 h/24) et 1 `pending` (`Pharmacie Grand Carrefour Koumassi`, `CI-ONP-2026-0842`).
- **22 médicaments essentiels** couvrant 8 catégories.
- **6 hôpitaux** (250 lits suivis lorsque `NEXT_PUBLIC_ENABLE_HOSPITALS="true"`).

| Rôle | Établissement | Email | Code | Code de secours |
| --- | --- | --- | --- | --- |
| Administrateur | Plateforme Kéné | `admin@kene.ci` | `ADMIN-2026` | `KNR-5A9E-4MTP` |
| Pharmacie (`verified`) | Pharmacie du Rond-Point | `officine.rondpoint@kene.ci` | `ROND-1024` | `KNR-7Q4M-2XKD` |
| Pharmacie (`verified`, garde) | Pharmacie Saint-Jean | `officine.saintjean@kene.ci` | `JEAN-2048` | `KNR-4T8W-9XNP` |
| Pharmacie (`pending`) | Pharmacie Grand Carrefour Koumassi | `officine.koumassi@kene.ci` | `KOUM-3096` | `KNR-7V2K-5BQM` |

*(Plus les 6 comptes hôpitaux de démonstration lorsque le module Phase 2 est activé.)*

## Structure

```
prisma/
  schema.prisma           schéma SQLite (dev/démo)
  schema.postgres.prisma  schéma PostgreSQL (prod)
  seed.ts                 initialisation CLI (resetDatabase)
app/
  api/health/route.ts     santé SQL + feature flags
  api/state/route.ts      état filtré + session + outbox
  api/auth/route.ts       login, register, logout, recover, change-code (Zod)
  api/actions/route.ts    mutations officine, CSV, modération admin, hôpital, resetDemo (Zod)
lib/
  features.ts             feature flags (hospitals, showDemoAccounts)
  geo.ts                  coordonnées Abidjan, Haversine, liens Google Maps GPS
  csv.ts                  parseur CSV stock (max 200 lignes) & modèle
  types.ts                modèles domaine V1
  engine.ts               recherche simple/liste, garde, tri GPS, aperçu officine
  format.ts               FCFA, téléphone, WhatsApp, Maps, dates
  seed.ts                 données démo (8 pharmacies, 22 médicaments, 6 hôpitaux)
  server/
    prisma.ts             client Prisma singleton
    db.ts                 seed, resetDatabase, loadPublicState filtré
    auth.ts               sessions SQL & cookies HttpOnly
    activity.ts           journal d'activité SQL
    outbox.ts             file d'emails SQL + backoff Knock
    http.ts               parseZod, isSameOrigin, rawTrimmed, réponses no-store
tests/
  engine.test.ts          tests moteur métier & visibilité verified
  geo-csv.test.ts         tests GPS Haversine & parseur CSV
  crypto-http.test.ts     tests scrypt, codes de secours & CSRF
```
