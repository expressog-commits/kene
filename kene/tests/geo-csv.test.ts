import assert from "node:assert/strict";
import test from "node:test";
import { parseStockCsv, STOCK_CSV_TEMPLATE } from "../lib/csv";
import {
  ABIDJAN_CENTER,
  COMMUNE_COORDS,
  coordsForQuartier,
  effectiveDistanceKm,
  haversineKm,
  mapsDirectionsLink,
} from "../lib/geo";

test("haversineKm et effectiveDistanceKm calculent une distance GPS cohérente", () => {
  assert.equal(haversineKm(ABIDJAN_CENTER, ABIDJAN_CENTER), 0);

  const dist = haversineKm(COMMUNE_COORDS.Plateau, COMMUNE_COORDS.Cocody);
  assert.ok(dist > 4 && dist < 8);

  const item = {
    latitude: COMMUNE_COORDS.Cocody.lat,
    longitude: COMMUNE_COORDS.Cocody.lng,
    distanceKm: 99,
  };
  assert.equal(effectiveDistanceKm(item, null), 99);
  assert.equal(effectiveDistanceKm(item, COMMUNE_COORDS.Plateau), dist);
});

test("coordsForQuartier gère accents, casse et fallback Abidjan", () => {
  assert.deepEqual(coordsForQuartier("adjame"), COMMUNE_COORDS.Adjamé);
  assert.deepEqual(coordsForQuartier("Port-Bouet"), COMMUNE_COORDS["Port-Bouët"]);
  assert.deepEqual(coordsForQuartier("Quartier Inconnu"), ABIDJAN_CENTER);
});

test("mapsDirectionsLink utilise GPS si disponible sinon fallback texte", () => {
  const withGps = mapsDirectionsLink(
    {
      name: "Pharmacie Test",
      address: "Rue 1",
      quartier: "Plateau",
      latitude: 5.3248,
      longitude: -4.0203,
    },
    { lat: 5.35, lng: -4.01 },
  );
  assert.ok(
    withGps.startsWith(
      "https://www.google.com/maps/dir/?api=1&destination=5.3248,-4.0203&origin=5.35,-4.01",
    ),
  );

  const withoutGps = mapsDirectionsLink({
    name: "Pharmacie Test",
    address: "Rue 1",
    quartier: "Plateau",
  });
  assert.ok(
    withoutGps.startsWith("https://www.google.com/maps/search/?api=1&query="),
  );
});

test("parseStockCsv parse le modèle, les séparateurs, les guillemets et valide les bornes", () => {
  const templateResult = parseStockCsv(STOCK_CSV_TEMPLATE);
  assert.equal(templateResult.errors.length, 0);
  assert.equal(templateResult.rows.length, 3);
  assert.equal(templateResult.rows[0].price, 700);
  assert.equal(templateResult.rows[0].quantity, 40);

  const commaCsv = [
    "name,molecule,form,category,price,stock",
    '"Ibuprofène 400 mg, boîte",Ibuprofène,"Boîte de 20",Douleur & fièvre,1000,25',
    "Erreur Prix,Test,Boîte,Digestion,-5,10",
    "Erreur Qté,Test,Boîte,Digestion,500,100000",
  ].join("\n");

  const res = parseStockCsv(commaCsv);
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].name, "Ibuprofène 400 mg, boîte");
  assert.equal(res.errors.length, 2);
});

test("parseStockCsv plafonne l'import à 200 lignes", () => {
  const lines = ["nom;prix;quantite"];
  for (let i = 1; i <= 205; i += 1) {
    lines.push(`Médicament ${i};1000;5`);
  }
  const res = parseStockCsv(lines.join("\n"));
  assert.equal(res.rows.length, 200);
  assert.ok(res.errors.some((e) => e.includes("200")));
});
